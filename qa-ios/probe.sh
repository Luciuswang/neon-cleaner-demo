#!/usr/bin/env bash
# Riverfall iOS Simulator load probe: real WKWebView, read-only, no taps, no screenshots.
# NOT executed where it was written (Windows, no Xcode). Run it on the macOS runner
# and read RESULT before reporting anything as tested or fixed.
set -euo pipefail
URL="${1:?usage: $0 URL}"
RE1='^https://luciuswang\.github\.io/neon-cleaner-demo/sunbreak/river/[^[:space:]]*$'
RE2='^http://127\.0\.0\.1(:[0-9]+)?(/[^[:space:]]*)?$'
[[ "$URL" =~ $RE1 || "$URL" =~ $RE2 ]] || { echo "URL not allowed" >&2; exit 2; }
BID=com.riverfall.qaprobe; EXE=RVProbe
W=$(mktemp -d); APP="$W/$EXE.app"; mkdir -p "$APP"

PICK=$(xcrun simctl list devices available -j | python3 -c '
import json,sys,re
best=None
for rt,ds in json.load(sys.stdin)["devices"].items():
    m=re.search(r"iOS-(\d+(?:-\d+)*)$",rt)
    if not m: continue
    v=tuple(int(x) for x in m.group(1).split("-"))
    for d in ds:
        if d.get("isAvailable") and d["name"].startswith("iPhone") and (best is None or v>best[0]): best=(v,d)
if not best: sys.exit("no available iPhone simulator")
print("\t".join([best[1]["udid"],best[1]["name"],".".join(map(str,best[0]))]))')
IFS=$'\t' read -r UDID NAME OS <<<"$PICK"
[ -n "$UDID" ] || { echo "no simulator found" >&2; exit 1; }
echo "DEVICE $NAME / iOS $OS"

cat >"$W/main.m" <<'EOF'
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <TargetConditionals.h>
#if !TARGET_OS_SIMULATOR || TARGET_OS_MACCATALYST
#error must build for iOS Simulator
#endif
static NSString *const kHook =
@"(function(){var p=function(m){try{webkit.messageHandlers.qa.postMessage(String(m).replace(/[?#][^ ]*/g,'').slice(0,300))}catch(_){}};"
"addEventListener('error',function(e){var t=e.target;if(t&&t!==window&&t.tagName)p('resource '+t.tagName+' '+(t.src||t.href||''));"
"else p('error '+e.message+' @'+e.filename+':'+e.lineno)},true);"
"addEventListener('unhandledrejection',function(e){var r=e.reason;p('rejection '+(r&&r.message||r))})})()";
static NSString *const kPoll =
@"(function(){var q=function(s){return document.querySelector(s)},b=document.body,e=q('#err'),s=q('#bootStatus');"
"var vis=function(x){return !!x&&x.getClientRects().length>0&&getComputedStyle(x).visibility!=='hidden'};"
"var c=function(v,n){return String(v==null?'':v).trim().replace(/[?#][^ ]*/g,'').slice(0,n)};"
"var m=(b?b.innerText:'').match(/我已了解|创建好友房|创建房间/);"
"return JSON.stringify({qa:c(b&&b.dataset.qa,80),err:vis(e)?c(e.innerText,200):'',"
"bootStatus:c(s?s.innerText:window.bootStatus,120),lobby:m?m[0]:'',readyState:document.readyState})})()";
@interface A : UIResponder <UIApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate>
@property (strong) UIWindow *window; @property (strong) WKWebView *web;
@property (strong) NSMutableArray *ev; @property int n; @property BOOL fin;
@end
@implementation A
- (void)note:(NSString *)s { if (self.ev.count < 20) [self.ev addObject:s]; }
- (void)userContentController:(WKUserContentController *)c didReceiveScriptMessage:(WKScriptMessage *)m {
  [self note:[NSString stringWithFormat:@"%@", m.body]]; }
- (void)webView:(WKWebView *)w didFailProvisionalNavigation:(WKNavigation *)n withError:(NSError *)e {
  [self note:[NSString stringWithFormat:@"navigation %@ %ld", e.domain, (long)e.code]]; }
- (void)done:(NSString *)s info:(NSDictionary *)d {
  if (self.fin) return; self.fin = YES;
  NSMutableDictionary *r = [d mutableCopy] ?: [NSMutableDictionary new];
  NSDictionary *env = NSProcessInfo.processInfo.environment;
  r[@"status"] = s; r[@"seconds"] = @(self.n); r[@"events"] = self.ev;
  r[@"os"] = UIDevice.currentDevice.systemVersion;
  r[@"model"] = env[@"SIMULATOR_MODEL_IDENTIFIER"] ?: @"";
  r[@"simulator"] = @(env[@"SIMULATOR_UDID"] != nil);
  NSData *j = [NSJSONSerialization dataWithJSONObject:r options:0 error:nil];
  NSString *p = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES)[0]
                 stringByAppendingPathComponent:@"result.json"];
  [j writeToFile:p atomically:YES];
}
- (void)tick {
  if (self.fin) return; self.n++;
  [self.web evaluateJavaScript:kPoll completionHandler:^(id v, NSError *e) {
    NSDictionary *d = [v isKindOfClass:NSString.class] ? [NSJSONSerialization
      JSONObjectWithData:[(NSString *)v dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : nil;
    NSString *err = d[@"err"], *qa = d[@"qa"], *lobby = d[@"lobby"];
    if (err.length) [self done:@"error" info:d];
    else if (qa.length && lobby.length) [self done:@"ready" info:d];
    else if (self.n >= 60) [self done:@"timeout" info:d];
  }];
}
- (BOOL)application:(UIApplication *)a didFinishLaunchingWithOptions:(NSDictionary *)o {
  self.ev = [NSMutableArray new];
  NSString *url = NSProcessInfo.processInfo.arguments.lastObject;
  WKWebViewConfiguration *cfg = [WKWebViewConfiguration new];
  [cfg.userContentController addScriptMessageHandler:self name:@"qa"];
  [cfg.userContentController addUserScript:[[WKUserScript alloc] initWithSource:kHook
    injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:NO]];
  self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
  UIViewController *vc = [UIViewController new];
  self.web = [[WKWebView alloc] initWithFrame:self.window.bounds configuration:cfg];
  self.web.navigationDelegate = self;
  self.web.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [vc.view addSubview:self.web];
  self.window.rootViewController = vc; [self.window makeKeyAndVisible];
  [self.web loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:url]]];
  [NSTimer scheduledTimerWithTimeInterval:1 target:self selector:@selector(tick) userInfo:nil repeats:YES];
  return YES;
}
@end
int main(int c, char **v) { @autoreleasepool { return UIApplicationMain(c, v, nil, @"A"); } }
EOF

cat >"$APP/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BID</string>
<key>CFBundleExecutable</key><string>$EXE</string>
<key>CFBundleName</key><string>$EXE</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array>
<key>UILaunchScreen</key><dict/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
EOF

xcrun --sdk iphonesimulator clang -fobjc-arc -target "$(uname -m)-apple-ios17.0-simulator" \
  -framework UIKit -framework WebKit -framework Foundation "$W/main.m" -o "$APP/$EXE"
xcrun vtool -show-build "$APP/$EXE" | grep -q IOSSIMULATOR || { echo "binary is not an iOS Simulator build" >&2; exit 1; }
codesign --force -s - "$APP"

xcrun simctl bootstatus "$UDID" -b
xcrun simctl uninstall "$UDID" "$BID" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BID" "$URL" >/dev/null

F=""
for _ in $(seq 1 90); do
  C=$(xcrun simctl get_app_container "$UDID" "$BID" data 2>/dev/null || true)
  if [ -n "$C" ] && [ -s "$C/Documents/result.json" ]; then F="$C/Documents/result.json"; break; fi
  sleep 1
done
[ -n "$F" ] || { echo 'RESULT {"status":"no_result"}'; exit 1; }
python3 -c '
import json,sys
r=json.load(open(sys.argv[1]))
print("RESULT "+json.dumps(r,ensure_ascii=False))
ok=r.get("status")=="ready" and r.get("simulator") is True
sys.exit(0 if ok else 1)' "$F"
