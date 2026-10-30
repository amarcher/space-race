import UIKit
import Capacitor

// The iOS 27 SDK refuses to launch an app without the UIScene life cycle
// ("UIScene life cycle is required"): build 22 / build 4, the first ones from
// Xcode 27.1, died on open for exactly this. Capacitor 8.5 routes scene events
// through SceneDelegateProxy; AppDelegate.configurationForConnecting names this
// class and Info.plist carries the matching UIApplicationSceneManifest.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Re-assert on every activation: the NativeAudio plugin resets the session
        // to plain .playback when it loads (after launch), and any configure() call
        // from JS would switch it to .ambient, which the silent switch mutes.
        AppDelegate.configureAudioSession()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
