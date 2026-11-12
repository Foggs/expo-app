import * as Application from "expo-application";
import Constants from "expo-constants";

/**
 * The installed app's version and build, e.g. "1.0.0 (5)". The build comes
 * from the native app, since build numbers are assigned remotely at build
 * time and the bundled config does not know them. Web shows the version only.
 */
export function getAppVersionLabel(): string {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "unknown";
  const build = Application.nativeBuildVersion;
  return build ? `${version} (${build})` : version;
}
