import argparse
import json
import random
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path


HOST = "http://127.0.0.1:8190"
COMFY_ROOT = Path(r"D:\AI\ComfyUI_windows_portable\ComfyUI")
REPO_ROOT = Path(__file__).resolve().parents[1]


def request_json(url, data=None, method=None, timeout=30):
    headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def ordered_input_names(class_info):
    names = []
    node_input = class_info.get("input", {})
    for group in ("required", "optional"):
        names.extend(node_input.get(group, {}).keys())
    return names


def normalize_links(raw_links):
    links = []
    for link in raw_links:
        if isinstance(link, dict):
            links.append(link)
            continue
        if isinstance(link, list) and len(link) >= 6:
            links.append(
                {
                    "id": link[0],
                    "origin_id": link[1],
                    "origin_slot": link[2],
                    "target_id": link[3],
                    "target_slot": link[4],
                    "type": link[5],
                }
            )
    return links


def resolve_link_origin(link, all_links, reroute_ids):
    origin_id = link["origin_id"]
    origin_slot = link["origin_slot"]
    while str(origin_id) in reroute_ids:
        incoming = [candidate for candidate in all_links if candidate["target_id"] == origin_id]
        if not incoming:
            break
        previous = incoming[0]
        origin_id, origin_slot = previous["origin_id"], previous["origin_slot"]
    return origin_id, origin_slot


def widget_value_for_input(node, input_index, widget_index):
    values = list(node.get("widgets_values") or [])
    if widget_index < len(values):
        return values[widget_index], widget_index + 1
    return None, widget_index


def build_api_prompt(workflow_path, output_prefix):
    object_info = request_json(f"{HOST}/object_info", timeout=60)
    workflow = json.loads(Path(workflow_path).read_text(encoding="utf-8"))
    subgraph = workflow["definitions"]["subgraphs"][0]
    nodes = {node["id"]: node for node in subgraph["nodes"]}
    all_links = normalize_links(subgraph.get("links", []))
    links_by_id = {link["id"]: link for link in all_links}
    reroute_ids = {str(node_id) for node_id, node in nodes.items() if node.get("type") == "Reroute"}

    prompt = {}
    for node_id, node in nodes.items():
        class_type = node["type"]
        if class_type == "Reroute":
            continue
        if class_type not in object_info:
            raise RuntimeError(f"Unknown ComfyUI node class: {class_type} (node {node_id})")

        api_inputs = {}
        widget_index = 0
        input_names = ordered_input_names(object_info[class_type])
        for input_index, node_input in enumerate(node.get("inputs", [])):
            name = node_input.get("name")
            link_id = node_input.get("link")
            has_widget = node_input.get("widget") is not None
            widget_value = None
            if has_widget:
                widget_value, widget_index = widget_value_for_input(node, input_index, widget_index)

            if link_id is None:
                if has_widget:
                    api_inputs[name] = widget_value
                continue

            link = links_by_id[link_id]
            origin_id, origin_slot = resolve_link_origin(link, all_links, reroute_ids)
            if origin_id == -10:
                if has_widget:
                    api_inputs[name] = widget_value
                    continue
                raise RuntimeError(f"Unhandled external input link {link_id} for {node_id}.{name}")
            api_inputs[name] = [str(origin_id), origin_slot]

        widget_values = list(node.get("widgets_values") or [])
        for input_name in input_names:
            if input_name in api_inputs:
                continue
            if widget_index >= len(widget_values):
                continue
            api_inputs[input_name] = widget_values[widget_index]
            widget_index += 1

        if class_type == "ResizeImageMaskNode" and len(widget_values) >= 5:
            api_inputs["resize_type"] = widget_values[0]
            api_inputs.setdefault("resize_type.width", widget_values[1])
            api_inputs.setdefault("resize_type.height", widget_values[2])
            api_inputs["resize_type.crop"] = widget_values[3]
            api_inputs["scale_method"] = widget_values[4]

        # Randomize the primary generation seed while keeping reproducibility in saved prompt.
        if class_type == "RandomNoise" and "noise_seed" in api_inputs and api_inputs.get("control_after_generate") != "fixed":
            api_inputs["noise_seed"] = random.randint(1, 2**63 - 1)

        prompt[str(node_id)] = {"class_type": class_type, "inputs": api_inputs}

    output_link = subgraph["outputs"][0]["linkIds"][0]
    output_origin_id, output_origin_slot = resolve_link_origin(links_by_id[output_link], all_links, reroute_ids)
    prompt["999"] = {
        "class_type": "SaveVideo",
        "inputs": {
            "video": [str(output_origin_id), output_origin_slot],
            "filename_prefix": output_prefix,
            "format": "mp4",
            "codec": "h264",
        },
    }
    return prompt


def submit(prompt, client_id):
    payload = {"prompt": prompt, "client_id": client_id}
    try:
        response = request_json(f"{HOST}/prompt", payload, timeout=60)
        print("SUBMIT", json.dumps(response, ensure_ascii=False, indent=2))
        return response["prompt_id"]
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "ignore")
        failed_path = REPO_ROOT / "tools" / "comfy" / "last_failed_t2v_api_prompt.json"
        failed_path.write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")
        print("HTTP ERROR", error.code, body)
        print(f"FAILED_PROMPT {failed_path}")
        raise


def poll(prompt_id, timeout_seconds):
    start = time.time()
    while True:
        history = request_json(f"{HOST}/history/{prompt_id}", timeout=30)
        if prompt_id in history:
            item = history[prompt_id]
            status = item.get("status", {})
            print("STATUS", json.dumps(status, ensure_ascii=False))
            if status.get("completed"):
                return item
            if status.get("status_str") == "error":
                raise RuntimeError(json.dumps(status, ensure_ascii=False, indent=2))

        queue = request_json(f"{HOST}/queue", timeout=30)
        print("QUEUE", queue.get("queue_running"), queue.get("queue_pending"), "elapsed", int(time.time() - start))
        if time.time() - start > timeout_seconds:
            raise TimeoutError("ComfyUI generation timed out")
        time.sleep(10)


def collect_outputs(history_item, output_prefix, copy_dir):
    outputs = history_item.get("outputs", {})
    candidates = []
    for node_output in outputs.values():
        if not isinstance(node_output, dict):
            continue
        for key in ("videos", "gifs", "files"):
            for file_info in node_output.get(key, []):
                if not isinstance(file_info, dict):
                    continue
                filename = file_info.get("filename")
                subfolder = file_info.get("subfolder", "")
                if filename:
                    candidates.append(COMFY_ROOT / "output" / subfolder / filename)

    safe_prefix = output_prefix.replace("\\", "/").split("/")[-1]
    candidates.extend(sorted((COMFY_ROOT / "output").rglob(f"{safe_prefix}*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True))
    candidates = [candidate for candidate in candidates if candidate.exists()]
    if not candidates:
        raise FileNotFoundError("No generated mp4 found")

    source = candidates[0]
    copied = None
    if copy_dir:
        copy_dir.mkdir(parents=True, exist_ok=True)
        copied = copy_dir / source.name
        shutil.copy2(source, copied)
    print(f"OUTPUT {source}")
    if copied:
        print(f"COPIED {copied}")
    print(f"SIZE_MB {source.stat().st_size / 1024 / 1024:.2f}")
    return source


def main():
    parser = argparse.ArgumentParser(description="Submit a generated LTX/Sulphur T2V UI workflow to ComfyUI API.")
    parser.add_argument("workflow", type=Path)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--copy-dir", type=Path, default=REPO_ROOT / "source" / "video" / "generated")
    parser.add_argument("--timeout", type=int, default=3600)
    args = parser.parse_args()

    request_json(f"{HOST}/system_stats", timeout=10)
    prompt = build_api_prompt(args.workflow, args.prefix)
    last_path = REPO_ROOT / "tools" / "comfy" / "last_t2v_api_prompt.json"
    last_path.write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"API_PROMPT {last_path}")
    prompt_id = submit(prompt, "neon-cleaner-t2v")
    history_item = poll(prompt_id, args.timeout)
    collect_outputs(history_item, args.prefix, args.copy_dir)


if __name__ == "__main__":
    main()
