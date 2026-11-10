import ExpoModulesCore
import GameKit
import UIKit

/// Signs the local player into Game Center and produces identity proofs the
/// SketchDuel server verifies against Apple's public key.
///
/// GameKit allows the authenticate handler to be set only once per launch, so
/// concurrent and repeated `authenticate` calls share that single attempt.
/// All state is touched on the main queue only.
public class GameCenterModule: Module {
  private var handlerInstalled = false
  private var authInFlight = false
  private var lastFailureReason = "unavailable"
  private var pendingAuthPromises: [Promise] = []

  public func definition() -> ModuleDefinition {
    Name("GameCenter")

    AsyncFunction("authenticate") { (promise: Promise) in
      self.authenticate(promise)
    }
    .runOnQueue(.main)

    AsyncFunction("fetchIdentityProof") { (promise: Promise) in
      self.fetchIdentityProof(promise)
    }
    .runOnQueue(.main)

    AsyncFunction("getFriendsAccess") { (promise: Promise) in
      self.getFriendsAccess(promise)
    }
    .runOnQueue(.main)

    AsyncFunction("loadFriends") { (promise: Promise) in
      self.loadFriends(promise)
    }
    .runOnQueue(.main)
  }

  /// The friend-list permission without prompting. Needs a signed-in player.
  private func getFriendsAccess(_ promise: Promise) {
    let player = GKLocalPlayer.local
    guard player.isAuthenticated else {
      promise.resolve("unavailable")
      return
    }
    player.loadFriendsAuthorizationStatus { status, error in
      DispatchQueue.main.async {
        if error != nil {
          promise.resolve("unavailable")
          return
        }
        promise.resolve(self.accessName(status))
      }
    }
  }

  /// Loads the player's friends. GameKit shows the permission prompt (using
  /// NSGKFriendListUsageDescription) when the player has not decided yet.
  private func loadFriends(_ promise: Promise) {
    let player = GKLocalPlayer.local
    guard player.isAuthenticated else {
      promise.resolve(["access": "unavailable", "friends": []])
      return
    }
    player.loadFriendsAuthorizationStatus { status, statusError in
      DispatchQueue.main.async {
        if statusError != nil {
          promise.resolve(["access": "unavailable", "friends": []])
          return
        }
        switch status {
        case .denied, .restricted:
          promise.resolve(["access": self.accessName(status), "friends": []])
          return
        default:
          break
        }
        player.loadFriends { friends, error in
          DispatchQueue.main.async {
            if let error = error as NSError? {
              if error.domain == GKErrorDomain {
                switch GKError.Code(rawValue: error.code) {
                case .friendListDenied?:
                  promise.resolve(["access": "denied", "friends": []])
                  return
                case .friendListRestricted?:
                  promise.resolve(["access": "restricted", "friends": []])
                  return
                default:
                  break
                }
              }
              promise.reject("ERR_GAME_CENTER_FRIENDS", error.localizedDescription)
              return
            }
            let list = (friends ?? []).map { friend -> [String: String] in
              ["playerId": friend.teamPlayerID, "displayName": friend.displayName]
            }
            promise.resolve(["access": "authorized", "friends": list])
          }
        }
      }
    }
  }

  private func accessName(_ status: GKFriendsAuthorizationStatus) -> String {
    switch status {
    case .authorized:
      return "authorized"
    case .denied:
      return "denied"
    case .restricted:
      return "restricted"
    case .notDetermined:
      return "notDetermined"
    @unknown default:
      return "unavailable"
    }
  }

  private func authenticate(_ promise: Promise) {
    let player = GKLocalPlayer.local
    if player.isAuthenticated {
      promise.resolve(playerInfo(player))
      return
    }

    if handlerInstalled && !authInFlight {
      // The single sign-in attempt for this launch already finished without a
      // player (declined, restricted or unavailable). GameKit will not prompt
      // again until the player signs in from Settings.
      promise.resolve(["authenticated": false, "reason": lastFailureReason])
      return
    }

    pendingAuthPromises.append(promise)
    if handlerInstalled {
      return
    }

    handlerInstalled = true
    authInFlight = true
    player.authenticateHandler = { [weak self] viewController, error in
      DispatchQueue.main.async {
        self?.handleAuthenticationUpdate(viewController: viewController, error: error)
      }
    }
  }

  private func handleAuthenticationUpdate(viewController: UIViewController?, error: Error?) {
    if let viewController = viewController {
      if let presenter = topViewController() {
        presenter.present(viewController, animated: true)
        return
      }
      finishAuthentication(["authenticated": false, "reason": "unavailable"])
      return
    }

    let player = GKLocalPlayer.local
    if player.isAuthenticated {
      finishAuthentication(playerInfo(player))
      return
    }

    lastFailureReason = failureReason(error)
    finishAuthentication(["authenticated": false, "reason": lastFailureReason])
  }

  private func finishAuthentication(_ result: [String: Any]) {
    authInFlight = false
    let promises = pendingAuthPromises
    pendingAuthPromises = []
    for promise in promises {
      promise.resolve(result)
    }
  }

  private func fetchIdentityProof(_ promise: Promise) {
    let player = GKLocalPlayer.local
    guard player.isAuthenticated else {
      promise.reject("ERR_GAME_CENTER_NOT_SIGNED_IN", "The player is not signed in to Game Center.")
      return
    }

    player.fetchItems(forIdentityVerificationSignature: { publicKeyURL, signature, salt, timestamp, error in
      DispatchQueue.main.async {
        if let error = error {
          promise.reject("ERR_GAME_CENTER_PROOF", error.localizedDescription)
          return
        }
        guard let publicKeyURL = publicKeyURL, let signature = signature, let salt = salt else {
          promise.reject("ERR_GAME_CENTER_PROOF", "Game Center returned an incomplete identity proof.")
          return
        }
        promise.resolve([
          "playerId": player.teamPlayerID,
          "publicKeyUrl": publicKeyURL.absoluteString,
          "signature": signature.base64EncodedString(),
          "salt": salt.base64EncodedString(),
          // UInt64 milliseconds; sent as a string so JavaScript never rounds it.
          "timestamp": String(timestamp),
        ])
      }
    })
  }

  private func playerInfo(_ player: GKLocalPlayer) -> [String: Any] {
    return [
      "authenticated": true,
      "playerId": player.teamPlayerID,
      "displayName": player.displayName,
    ]
  }

  private func failureReason(_ error: Error?) -> String {
    guard let error = error else {
      return "unavailable"
    }
    let nsError = error as NSError
    if nsError.domain == GKErrorDomain {
      switch GKError.Code(rawValue: nsError.code) {
      case .cancelled?, .userDenied?:
        return "declined"
      default:
        return "unavailable"
      }
    }
    return "unavailable"
  }

  private func topViewController() -> UIViewController? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    let keyWindow = windows.first(where: { $0.isKeyWindow }) ?? windows.first
    var current = keyWindow?.rootViewController
    while let presented = current?.presentedViewController {
      current = presented
    }
    return current
  }
}
