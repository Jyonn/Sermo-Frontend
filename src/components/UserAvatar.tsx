import { useEffect, useState } from "react";

interface UserAvatarProps {
  name: string;
  uri?: string | null;
  className: string;
}

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function UserAvatar({ name, uri, className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const canShowImage = Boolean(uri) && !failed;

  return (
    <div className={`${className} ${canShowImage ? "avatar-has-image" : ""}`}>
      {canShowImage ? (
        <img
          alt={`${name} avatar`}
          className="avatar-image"
          loading="lazy"
          src={uri ?? ""}
          onError={() => setFailed(true)}
        />
      ) : (
        avatarLabel(name)
      )}
    </div>
  );
}
