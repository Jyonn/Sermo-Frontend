let active:HTMLMediaElement|null=null;
/** A user-started clip takes over from the previous feed clip or music player. */
export function claimMediaPlayback(media:HTMLMediaElement){
  if(active&&active!==media)active.pause();
  active=media;
}
export function releaseMediaPlayback(media:HTMLMediaElement){if(active===media)active=null}
