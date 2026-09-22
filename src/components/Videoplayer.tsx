import React from "react"
import { CustomVideoPlayer, type CustomVideoPlayerProps } from "./player"

export interface VideoPlayerProps extends CustomVideoPlayerProps {}

export default function VideoPlayer(props: VideoPlayerProps) {
  return <CustomVideoPlayer {...props} />
}

export { VideoPlayer, VideoPlayer as Videoplayer }

