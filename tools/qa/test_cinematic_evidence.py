"""Adversarial regression tests: no UE process, no project mutations."""
import hashlib
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib
import verify_cinematic_evidence as gate


def chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))


def png(w=2, h=2, raw=None):
    if raw is None: raw = (b'\0' + bytes(w * 3)) * h
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class EvidenceGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, payload):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        return path

    def record(self, path):
        return {'path': path.relative_to(self.root).as_posix(), 'sha256': gate.sha256(path)}

    def dependency_fixture(self):
        for folder in ('Content', 'Config', 'Source'):
            (self.root / gate.PROJECT / folder).mkdir(parents=True, exist_ok=True)
        self.write(gate.PROJECT + 'NeonCleanerUE.uproject', b'{}\n')
        self.write(gate.BUILD_PATHS['runtime_binary'], b'fake PE fixture\n')

    def test_text_lf_crlf_and_mixed_newlines_are_equivalent(self):
        self.dependency_fixture()
        names = ['NeonCleanerUE.uproject'] + [
            folder + '/Nested/Example' + extension
            for folder in ('Source', 'Config')
            for extension in sorted(gate.TEXT_DEPENDENCY_EXTENSIONS)]
        for name in names:
            with self.subTest(path=name):
                path = self.write(gate.PROJECT + name, b'first\nsecond\nthird\n')
                initial = gate.fingerprint(self.root)
                for payload in (b'first\r\nsecond\r\nthird\r\n', b'first\r\nsecond\nthird\r\n'):
                    path.write_bytes(payload)
                    self.assertEqual(initial, gate.fingerprint(self.root))

    def test_text_whitespace_bom_lone_cr_and_content_remain_significant(self):
        self.dependency_fixture()
        for name in ('NeonCleanerUE.uproject', 'Source/Example.cpp', 'Config/DefaultEngine.ini'):
            path = self.write(gate.PROJECT + name, b'first\nsecond\n')
            initial = gate.fingerprint(self.root)
            for payload in (b'first \nsecond\n', b'\xef\xbb\xbffirst\nsecond\n',
                            b'first\rsecond\n', b'First\nsecond\n', b'first\nsecond'):
                with self.subTest(path=name, payload=payload):
                    path.write_bytes(payload)
                    self.assertNotEqual(initial, gate.fingerprint(self.root))

    def test_binary_and_content_text_newlines_remain_byte_exact(self):
        self.dependency_fixture()
        names = [gate.BUILD_PATHS['runtime_binary'], gate.BUILD_PATHS['map']] + [
            gate.PROJECT + name for name in ('Content/Example.uasset', 'Content/Example.ini',
                                             'Content/Example.json', 'Source/Example.png', 'Config/Example.uasset')]
        for name in names:
            with self.subTest(path=name):
                path = self.write(name, b'first\nsecond\n')
                initial = gate.fingerprint(self.root)
                path.write_bytes(b'first\r\nsecond\r\n')
                self.assertNotEqual(initial, gate.fingerprint(self.root))

    def test_dependency_add_rename_and_delete_change_fingerprint(self):
        self.dependency_fixture()
        initial = gate.fingerprint(self.root)
        path = self.write(gate.PROJECT + 'Source/Example.cpp', b'content\n')
        added = gate.fingerprint(self.root)
        self.assertNotEqual(initial, added)
        renamed = path.with_name('Renamed.cpp')
        path.rename(renamed)
        self.assertNotEqual(added, gate.fingerprint(self.root))
        renamed.unlink()
        self.assertEqual(initial, gate.fingerprint(self.root))

    def test_legacy_algorithm_retains_historical_exact_bytes(self):
        self.dependency_fixture()
        path = self.write(gate.PROJECT + 'Source/Example.cpp', b'first\nsecond\n')
        paths = [self.root / gate.PROJECT / 'NeonCleanerUE.uproject',
                 self.root / gate.BUILD_PATHS['runtime_binary'], path]
        historical = hashlib.sha256()
        for dependency in sorted(paths, key=lambda p: p.as_posix()):
            historical.update((dependency.relative_to(self.root).as_posix() + '\0' +
                               gate.sha256(dependency) + '\n').encode('utf-8'))
        legacy = gate.fingerprint(self.root, format=gate.LEGACY_DEPENDENCY_HASH_FORMAT)
        self.assertEqual(historical.hexdigest(), legacy)
        self.assertNotEqual(legacy, gate.fingerprint(self.root))
        path.write_bytes(b'first\r\nsecond\r\n')
        self.assertNotEqual(legacy, gate.fingerprint(self.root, format=gate.LEGACY_DEPENDENCY_HASH_FORMAT))

    def test_unknown_or_absent_format_is_not_inferred(self):
        self.dependency_fixture()
        for value in (None, '', 'unknown', 'neon-deps-v3', [], {}):
            with self.subTest(format=value):
                with self.assertRaises(ValueError): gate.fingerprint(self.root, format=value)
                errors = gate.verify({'build': {'dependency_hash_format': value}}, self.root)
                self.assertIn('Explicit recognized dependency_hash_format required', errors)

    def test_valid_png_and_corruption(self):
        path = self.write('view.png', png())
        self.assertEqual(gate.png_dimensions(path), (2, 2))
        bad = bytearray(png()); bad[-5] ^= 1; path.write_bytes(bad)
        with self.assertRaises(ValueError): gate.png_dimensions(path)

    def test_header_only_and_forged_dimensions_rejected(self):
        path = self.write('view.png', png()[:24])
        with self.assertRaises(ValueError): gate.png_dimensions(path)
        path.write_bytes(png(1920, 1080, raw=b'\0\0\0\0'))
        with self.assertRaises(ValueError): gate.png_dimensions(path)

    def test_invalid_scanline_filter_rejected(self):
        path = self.write('view.png', png(1, 1, raw=b'\xff\0\0\0'))
        with self.assertRaises(ValueError): gate.png_dimensions(path)

    def test_dependencies_include_materials_config_and_source(self):
        base = self.root / gate.PROJECT
        for folder in ('Content', 'Config', 'Source'): (base / folder).mkdir(parents=True)
        self.write(gate.PROJECT + 'NeonCleanerUE.uproject', b'{}')
        self.write(gate.BUILD_PATHS['runtime_binary'], b'fake PE fixture')
        material = self.write(gate.PROJECT + 'Content/private.uasset', b'private binary A')
        initial = gate.fingerprint(self.root)
        material.write_bytes(b'private binary B')
        self.assertNotEqual(initial, gate.fingerprint(self.root))
        initial = gate.fingerprint(self.root)
        self.write(gate.PROJECT + 'Config/DefaultEngine.ini', b'changed render settings')
        self.assertNotEqual(initial, gate.fingerprint(self.root))
        initial = gate.fingerprint(self.root)
        self.write(gate.PROJECT + 'Source/Example.cpp', b'changed implementation')
        self.assertNotEqual(initial, gate.fingerprint(self.root))

    def test_raw_performance_derives_percentiles(self):
        text = 'timestamp_seconds,frame_ms\n' + ''.join(f'{i*.02:.6f},20\n' for i in range(1601))
        path = self.write('perf.csv', text.encode())
        duration, p50, p95 = gate.performance_stats(path)
        self.assertAlmostEqual(duration, 32)
        self.assertEqual((p50, p95), (20, 20))
        path.write_text('timestamp_seconds,frame_ms\n0,20\n30,20\n')
        with self.assertRaises(ValueError): gate.performance_stats(path)

    def test_nan_performance_rejected(self):
        path = self.write('perf.csv', b'timestamp_seconds,frame_ms\n0,20\n1,nan\n')
        with self.assertRaises(ValueError): gate.performance_stats(path)

    def test_complete_motion_provenance_and_gap(self):
        text = ''.join(f'[NeonRiderVideo] frame={i} t={4+i/30:.6f}\n' for i in range(360))
        text += '[NeonRiderVideo] Completed requestedFrames=360\n'
        path = self.write('runtime.log', text.encode())
        gate.motion_log_valid(path, 12, 30)
        path.write_text(text.replace('frame=100 ', 'frame=101 '))
        with self.assertRaises(ValueError): gate.motion_log_valid(path, 12, 30)
        path.write_text('Historical AI video, no UE render provenance')
        with self.assertRaises(ValueError): gate.motion_log_valid(path, 12, 30)

    def test_original_false_pass_report_rejected(self):
        fake = self.record(self.write('notes.md', b'not an image, DLL, map, or CSV'))
        video = self.record(self.write('historical-ai.mp4', b'not an actual video'))
        evidence = []
        for view in gate.REQUIRED_VIEWS:
            artifact = dict(video if view == 'rider_motion' else fake)
            artifact.update(id=view, view=view, reviewed=True, notes='metadata only', duration_seconds=12, fps=30)
            evidence.append(artifact)
        report = {'schema': 2, 'producer': 'p', 'reviewer': 'r', 'reviewed_at': 'now', 'engine': 'UE5',
                  'build': {'runtime_binary': fake, 'map': fake}, 'evidence': evidence,
                  'domains': {domain: {'verdict': 'PASS', 'notes': 'assertion', 'evidence': ['performance']} for domain in gate.DOMAINS},
                  'performance': {'duration_seconds': 30, 'p50_frame_ms': 20, 'p95_frame_ms': 30,
                                  'hardware': 'GPU', 'settings': 'high', 'width': 1920, 'height': 1080, 'fixed_timestep': False}}
        with patch.object(gate, 'video_metadata', side_effect=ValueError('Invalid actual video stream')):
            errors = gate.verify(report, self.root)
        for expected in ('noncanonical path', 'invalid binary signature', 'image view requires PNG',
                         'domain-specific views not referenced', 'raw performance CSV required', 'ue_frame_log: missing file'):
            self.assertTrue(any(expected in error for error in errors), expected)

    def test_missing_report_is_blocked(self):
        self.assertTrue(gate.verify({}, self.root))

    def test_complete_synthetic_schema_can_pass_integrity_checks(self):
        # Synthetic fixture tests schema mechanics, never represents an art pass.
        for folder in ('Content', 'Config', 'Source'):
            (self.root / gate.PROJECT / folder).mkdir(parents=True)
        pe = bytearray(68); pe[:2] = b'MZ'; struct.pack_into('<I', pe, 60, 64); pe[64:] = b'PE\0\0'
        dll = self.write(gate.BUILD_PATHS['runtime_binary'], pe)
        level = self.write(gate.BUILD_PATHS['map'], b'\xc1\x83\x2a\x9e' + bytes(60))
        self.write(gate.PROJECT + 'NeonCleanerUE.uproject', b'{}')
        fingerprint = gate.fingerprint(self.root)
        log_text = ''.join(f'[NeonRiderVideo] frame={i} t={4+i/30:.6f}\n' for i in range(360))
        log = self.write('capture.log', (log_text + '[NeonRiderVideo] Completed requestedFrames=360\n').encode())
        evidence = []
        for index, view in enumerate(sorted(gate.REQUIRED_VIEWS)):
            if view in gate.IMAGE_VIEWS:
                row = b'\0' + bytes([index % 255]) * (1920 * 3)
                path = self.write(view + '.png', png(1920, 1080, row * 1080))
            elif view == 'rider_motion':
                path = self.write('motion.mp4', b'synthetic video, media probe mocked only in this test')
            elif view == 'performance':
                text = 'timestamp_seconds,frame_ms\n' + ''.join(f'{i*.02:.6f},20\n' for i in range(1601))
                path = self.write('perf.csv', text.encode())
            else:
                path = self.write(view + '.json', b'{"fixture":true}')
            item = self.record(path)
            item.update(id=view, view=view, reviewed=True, notes='Synthetic fixture review', build_fingerprint=fingerprint)
            if view == 'rider_motion':
                item.update(ue_frame_log=self.record(log), actions_reviewed=['neutral', 'left', 'right', 'return', 'brake'])
            evidence.append(item)
        report = {'schema': 2, 'producer': 'fixture-producer', 'reviewer': 'fixture-reviewer', 'reviewed_at': '2026-09-16', 'engine': 'UE5',
                  'build': {'runtime_binary': self.record(dll), 'map': self.record(level), 'dependencies_sha256': fingerprint,
                            'dependency_hash_format': gate.DEPENDENCY_HASH_FORMAT},
                  'evidence': evidence, 'domains': {domain: {'verdict': 'PASS', 'notes': 'Synthetic fixture', 'evidence': list(views)} for domain, views in gate.DOMAIN_VIEWS.items()},
                  'performance': {'hardware': 'fixture', 'settings': 'fixture', 'width': 1920, 'height': 1080, 'fixed_timestep': False}}
        with patch.object(gate, 'video_metadata', return_value=(12, 30, 1920, 1080)):
            self.assertEqual(gate.verify(report, self.root), [])
            # A report may intentionally retain the historical algorithm, but
            # cannot silently choose it by omitting its format declaration.
            legacy = gate.fingerprint(self.root, format=gate.LEGACY_DEPENDENCY_HASH_FORMAT)
            report['build'].update(dependency_hash_format=gate.LEGACY_DEPENDENCY_HASH_FORMAT,
                                   dependencies_sha256=legacy)
            for item in evidence: item['build_fingerprint'] = legacy
            self.assertEqual(gate.verify(report, self.root), [])
            del report['build']['dependency_hash_format']
            self.assertIn('Explicit recognized dependency_hash_format required', gate.verify(report, self.root))
            report['build']['dependency_hash_format'] = gate.LEGACY_DEPENDENCY_HASH_FORMAT
            evidence[0]['dependency_hash_format'] = gate.DEPENDENCY_HASH_FORMAT
            self.assertTrue(any('mixed dependency_hash_format' in error for error in gate.verify(report, self.root)))


if __name__ == '__main__': unittest.main()
