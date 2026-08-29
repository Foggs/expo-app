import { Redirect, useLocalSearchParams } from "expo-router";
import { parseFriendInviteCode } from "@/lib/friendInvite";

export default function FriendInviteRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const roomCode = parseFriendInviteCode(code);

  if (!roomCode) {
    return <Redirect href="/" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/",
        params: { inviteCode: roomCode },
      }}
    />
  );
}