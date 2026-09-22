import React from "react"
import { PlayerControls, type PlayerControlsProps } from "./PlayerControls"

export type ControlsBarProps = PlayerControlsProps

export const ControlsBar: React.FC<ControlsBarProps> = (props) => {
  return <PlayerControls {...props} />
}

export default ControlsBar
