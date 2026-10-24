import Cocoa
import WebKit
import UserNotifications

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate,
    WKScriptMessageHandler
{
    private var window: NSWindow!
    private var webView: WKWebView!
    private var serverProcess: Process?
    private var projectDir = "/Users/m.w/word-app"
    private var npmPath = "/Users/m.w/.nvm/versions/node/v24.22.0/bin/npm"
    private let serverURL = URL(string: "http://127.0.0.1:4173/")!
    private let logURL = URL(fileURLWithPath: "/tmp/shici-native.log")

    private let loadingHTML = """
    <!doctype html>
    <html lang="zh-CN">
    <head><meta charset="utf-8"><style>
      html,body{height:100%;margin:0}
      body{display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:14px;background:#f7f3ea;color:#67736b;
        font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:13px}
      .ring{width:28px;height:28px;border-radius:50%;border:2.5px solid #ece6d8;
        border-top-color:#2e6b4f;animation:spin .8s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style></head>
    <body><div class="ring"></div><p>正在打开拾词…</p></body></html>
    """

    func applicationDidFinishLaunching(_ notification: Notification) {
        loadConfig()
        // The native wrapper always reads from the local server; clear the HTTP
        // cache so a rebuilt web app is picked up on the next launch.
        URLCache.shared.removeAllCachedResponses()
        log("launch; project=\(projectDir)")
        buildMenu()
        buildWindow()
        prepareServerAndLoad()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    // The local preview server is intentionally left running when the app
    // quits, so the same app stays available from a phone on the LAN and is
    // reused on the next launch. It uses very little memory and can be stopped
    // from Activity Monitor if needed.

    // MARK: - Setup

    private func loadConfig() {
        guard
            let url = Bundle.main.url(forResource: "config", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }
        if let value = object["projectDir"] as? String { projectDir = value }
        if let value = object["npmPath"] as? String { npmPath = value }
    }

    private func buildWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "shici")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "拾词"
        window.minSize = NSSize(width: 360, height: 640)
        window.contentView = webView
        if !window.setFrameUsingName("ShiciMainWindow") {
            window.center()
        }
        window.setFrameAutosaveName("ShiciMainWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        webView.loadHTMLString(loadingHTML, baseURL: nil)
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(
            withTitle: "关于 拾词",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        )
        appMenu.addItem(.separator())
        let reloadItem = NSMenuItem(
            title: "重新加载",
            action: #selector(reloadPage),
            keyEquivalent: "r"
        )
        reloadItem.target = self
        appMenu.addItem(reloadItem)
        appMenu.addItem(.separator())
        appMenu.addItem(
            withTitle: "退出 拾词",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        let windowItem = NSMenuItem()
        mainMenu.addItem(windowItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(
            withTitle: "最小化",
            action: #selector(NSWindow.performMiniaturize(_:)),
            keyEquivalent: "m"
        )
        windowMenu.addItem(
            withTitle: "缩放",
            action: #selector(NSWindow.performZoom(_:)),
            keyEquivalent: ""
        )
        windowItem.submenu = windowMenu
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = mainMenu
    }

    // MARK: - Local server

    private func prepareServerAndLoad() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            let ready = self.isServerReady()
            DispatchQueue.main.async {
                if !ready { self.startServer() }
                self.waitForServer(attempts: 30)
            }
        }
    }

    private func isServerReady() -> Bool {
        var request = URLRequest(url: serverURL)
        request.timeoutInterval = 1.5
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let semaphore = DispatchSemaphore(value: 0)
        var ready = false
        URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                ready = true
            }
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 2)
        return ready
    }

    private func startServer() {
        guard FileManager.default.fileExists(atPath: projectDir) else {
            log("project directory missing: \(projectDir)")
            return
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: npmPath)
        process.arguments = ["run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
        process.currentDirectoryURL = URL(fileURLWithPath: projectDir)

        var environment = ProcessInfo.processInfo.environment
        let nodeBin = (npmPath as NSString).deletingLastPathComponent
        environment["PATH"] = "\(nodeBin):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        process.environment = environment

        let previewLog = "/tmp/shici-preview.log"
        if !FileManager.default.fileExists(atPath: previewLog) {
            FileManager.default.createFile(atPath: previewLog, contents: nil)
        }
        if let handle = FileHandle(forWritingAtPath: previewLog) {
            process.standardOutput = handle
            process.standardError = handle
        }

        do {
            try process.run()
            serverProcess = process
            log("started preview server pid \(process.processIdentifier)")
        } catch {
            log("failed to start preview server: \(error.localizedDescription)")
        }
    }

    private func waitForServer(attempts: Int) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            let ready = self.isServerReady()
            DispatchQueue.main.async {
                if ready {
                    self.loadApp()
                } else if attempts <= 0 {
                    self.showStartupError()
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        self.waitForServer(attempts: attempts - 1)
                    }
                }
            }
        }
    }

    private func loadApp() {
        log("loading app")
        webView.load(URLRequest(url: serverURL, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func showStartupError() {
        log("server did not become ready")
        let escapedPath = projectDir.replacingOccurrences(of: "<", with: "&lt;")
        let html = """
        <!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
        html,body{height:100%;margin:0}
        body{display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:10px;background:#f7f3ea;color:#3e4b43;padding:32px;box-sizing:border-box;
          font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:center}
        h2{font-size:18px;margin:0}p{font-size:13px;line-height:1.7;color:#67736b;margin:0}
        code{font-size:12px;background:#fffdf8;padding:2px 6px;border-radius:6px}
        </style></head><body>
        <h2>本地服务没有启动</h2>
        <p>请确认项目仍在 <code>\(escapedPath)</code>，<br>然后按 ⌘R 重试。</p>
        </body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: - Native notifications

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "shici",
              let body = message.body as? [String: Any],
              body["type"] as? String == "reminder"
        else { return }

        let enabled = body["enabled"] as? Bool ?? false
        let time = body["time"] as? String ?? "20:00"
        scheduleReminder(enabled: enabled, time: time)
    }

    private func scheduleReminder(enabled: Bool, time: String) {
        log("reminder request enabled=\(enabled) time=\(time)")
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["shici-daily-reminder"])

        guard enabled else {
            postReminderStatus(granted: true, enabled: false, message: "每日提醒已关闭")
            return
        }

        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]),
              (0...23).contains(hour),
              (0...59).contains(minute)
        else {
            postReminderStatus(granted: false, enabled: false, message: "提醒时间格式无效")
            return
        }

        center.requestAuthorization(options: [.alert, .sound]) { [weak self] granted, error in
            guard let self = self else { return }
            self.log("notification authorization granted=\(granted)")
            if !granted || error != nil {
                self.postReminderStatus(
                    granted: false,
                    enabled: false,
                    message: "通知权限未开启，请在系统设置中允许拾词发送通知"
                )
                return
            }

            let content = UNMutableNotificationContent()
            content.title = "拾词"
            content.body = "今天的单词还在等你，来记几个吧。"
            content.sound = .default

            var components = DateComponents()
            components.hour = hour
            components.minute = minute
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: components,
                repeats: true
            )
            let request = UNNotificationRequest(
                identifier: "shici-daily-reminder",
                content: content,
                trigger: trigger
            )
            center.add(request) { error in
                if let error = error {
                    self.postReminderStatus(
                        granted: true,
                        enabled: false,
                        message: "提醒设置失败：\(error.localizedDescription)"
                    )
                } else {
                    self.log("notification scheduled at \(time)")
                    self.postReminderStatus(
                        granted: true,
                        enabled: true,
                        message: "每日 \(time) 提醒已开启"
                    )
                }
            }
        }
    }

    private func postReminderStatus(granted: Bool, enabled: Bool, message: String) {
        let payload: [String: Any] = [
            "granted": granted,
            "enabled": enabled,
            "message": message,
        ]
        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8)
        else { return }

        let js = "window.dispatchEvent(new CustomEvent('shici-reminder-status', { detail: \(json) }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - Navigation

    @objc private func reloadPage() {
        loadApp()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "about" || url.host == "127.0.0.1" || url.host == "localhost" {
            decisionHandler(.allow)
        } else if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        log("didFinish \(webView.url?.absoluteString ?? "")")
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        log("didFail \(error.localizedDescription)")
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        log("didFailProvisional \(error.localizedDescription)")
    }

    // MARK: - Logging

    private func log(_ message: String) {
        let line = "[\(Date())] \(message)\n"
        guard let data = line.data(using: .utf8) else { return }
        if FileManager.default.fileExists(atPath: logURL.path) {
            if let handle = try? FileHandle(forWritingTo: logURL) {
                handle.seekToEndOfFile()
                handle.write(data)
                try? handle.close()
            }
        } else {
            try? data.write(to: logURL)
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
