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
static BOOL gBusy; static NSDate *gT0,*gBoot; static NSString *gSrc,*gSig; static NSDictionary *gLast; static NSString *const kSep=@"@@RIVERBOOT@@";
static NSString *const kBootJS=@"(function(){try{var e=document.getElementById('err'),c=function(v,n){return String(v==null?'':v).replace(/[?#]\\S*/g,'').slice(0,n)};return JSON.stringify({bootStage:c(window.riverBootStage,80),err:c(e&&e.textContent,240),ready:document.readyState,host:location.host,path:location.pathname})}catch(x){return '{}'}})()";
-(id)json:(NSString*)s{ NSData *d=[s dataUsingEncoding:NSUTF8StringEncoding]; id o=d.length?[NSJSONSerialization JSONObjectWithData:d options:0 error:nil]:nil; return [o isKindOfClass:NSDictionary.class]?o:nil; }
-(void)fail:(NSString*)why{ if(self.fin)return;
  NSMutableDictionary *d=[NSMutableDictionary dictionaryWithDictionary:gLast?:@{}];
  NSMutableArray *f=[NSMutableArray arrayWithArray:[d[@"failures"] isKindOfClass:NSArray.class]?d[@"failures"]:@[]];
  [f addObject:why]; d[@"failures"]=f; d[@"pass"]=@NO; d[@"native"]=why; if(!d[@"stage"])d[@"stage"]=@"none";
  d[@"elapsed"]=@(gT0?-[gT0 timeIntervalSinceNow]:-1); d[@"ticks"]=@(self.n);
  [self note:[NSString stringWithFormat:@"FAIL %@ stage=%@ boot=%@",why,d[@"stage"],d[@"boot"]?:@"?"]]; [self done:@"failed" info:d]; }
-(void)webView:(WKWebView*)w didFinishNavigation:(WKNavigation*)nav{ NSURL *u=w.URL;
  if(self.fin||!u||![u.scheme hasPrefix:@"http"])return;
  [self note:[NSString stringWithFormat:@"nav finished %@%@",u.host?:@"",u.path?:@""]];
  if(gT0)return; gT0=[NSDate date];
  if(!gSrc){ NSString *p=[[NSBundle mainBundle] pathForResource:@"probe" ofType:@"js"]; NSString *s=p?[NSString stringWithContentsOfFile:p encoding:NSUTF8StringEncoding error:nil]:nil;
    s=[s stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    while([s hasSuffix:@";"]) s=[[s substringToIndex:s.length-1] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if(!s.length){ [self fail:@"probe.js missing or empty"]; return; }
    gSrc=[NSString stringWithFormat:@"%@+'%@'+%@;",s,kSep,kBootJS]; }
  [self tick]; }
-(void)webViewWebContentProcessDidTerminate:(WKWebView*)w{ gBusy=NO; [self fail:@"web content process terminated"]; }
-(void)tick{ if(self.fin)return;
  [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(tick) object:nil]; [self performSelector:@selector(tick) withObject:nil afterDelay:1.0];
  if(!gBoot)gBoot=[NSDate date];
  if(!gT0){ if(-[gBoot timeIntervalSinceNow]>90)[self fail:@"no http(s) navigation finished within 90s"]; return; }
  NSTimeInterval el=-[gT0 timeIntervalSinceNow]; self.n=(int)el;
  if(el>90){ [self fail:gBusy?@"timeout 90s (evaluate still in flight)":@"timeout 90s"]; return; }
  if(gBusy||!gSrc)return; gBusy=YES;
  [self.web evaluateJavaScript:gSrc completionHandler:^(id r,NSError *e){ dispatch_async(dispatch_get_main_queue(),^{ gBusy=NO; if(self.fin)return;
    NSMutableDictionary *d=[NSMutableDictionary dictionaryWithDictionary:gLast?:@{}];
    if(e||![r isKindOfClass:NSString.class]){ d[@"evalError"]=e?(e.userInfo[@"WKJavaScriptExceptionMessage"]?:e.localizedDescription):@"non-string result"; gLast=d;
      NSString *g=[@"E:" stringByAppendingString:[d[@"evalError"] description]]; if(![g isEqualToString:gSig]){ gSig=g; [self note:[@"probe eval error: " stringByAppendingString:[d[@"evalError"] description]]]; } return; }
    NSString *s=r; NSRange k=[s rangeOfString:kSep options:NSBackwardsSearch];
    NSDictionary *p=[self json:k.location==NSNotFound?s:[s substringToIndex:k.location]], *b=k.location==NSNotFound?nil:[self json:[s substringFromIndex:NSMaxRange(k)]];
    if(p){ d=[NSMutableDictionary dictionaryWithDictionary:p]; } else d[@"evalError"]=@"probe returned non-JSON";
    if(b)d[@"boot"]=b; gLast=d;
    NSString *g=[NSString stringWithFormat:@"stage=%@ boot=%@ err=%@ t=",d[@"stage"]?:@"?",b[@"bootStage"]?:@"?",b[@"err"]?:@""];
    if(![g isEqualToString:gSig]){ gSig=g; [self note:[g stringByAppendingFormat:@"%.1f",-[gT0 timeIntervalSinceNow]]]; }
    if(!p||![p[@"done"] isKindOfClass:NSNumber.class]||![p[@"done"] boolValue])return;
    BOOL ok=[p[@"pass"] isKindOfClass:NSNumber.class]&&[p[@"pass"] boolValue]&&!([p[@"failures"] isKindOfClass:NSArray.class]&&[p[@"failures"] count]);
    d[@"elapsed"]=@(-[gT0 timeIntervalSinceNow]); [self done:ok?@"ready":@"failed" info:d]; }); }]; }
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
cp "$(dirname "$0")/probe.js" "$APP/probe.js"
codesign --force -s - "$APP"

xcrun simctl bootstatus "$UDID" -b
xcrun simctl uninstall "$UDID" "$BID" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BID" "$URL" >/dev/null

F=""
for _ in $(seq 1 165); do
  C=$(xcrun simctl get_app_container "$UDID" "$BID" data 2>/dev/null || true)
  if [ -n "$C" ] && [ -s "$C/Documents/result.json" ]; then F="$C/Documents/result.json"; break; fi
  sleep 1
done
[ -n "$F" ] || { echo 'RESULT {"status":"no_result"}'; exit 1; }
python3 -c '
import json,sys
r=json.load(open(sys.argv[1]))
print("RESULT "+json.dumps(r,ensure_ascii=False))
ok=r.get("status")=="ready" and bool(r.get("simulator"))
sys.exit(0 if ok else 1)' "$F"
