import React, { useState } from "react"
import { MuteButton } from "./MuteButton"
import { VolumeSlider } from "./VolumeSlider"

export interface VolumeControlProps {
  className?: string
  alwaysExpanded?: boolean
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  className = "",
  alwaysExpanded = false,
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const showSlider = alwaysExpanded || isHovered || isAdjusting || isFocused

  return (
    <div
      className={`group/vol flex items-center transition-all duration-200 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <MuteButton />

      <div
        className={`flex items-center overflow-hidden transition-all duration-200 ease-out origin-left ${
          showSlider
            ? "w-14 sm:w-16 md:w-20 opacity-100 ml-1"
            : "w-0 opacity-0 ml-0 pointer-events-none"
        }`}
      >
        <VolumeSlider onAdjustChange={setIsAdjusting} />
      </div>
    </div>
  )
}

export default VolumeControl
