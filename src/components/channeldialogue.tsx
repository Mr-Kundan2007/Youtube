import React, { useState, useEffect } from "react"
import { useRouter } from "next/router"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import axiosInstance from "@/lib/axiosinstance"
import { useAuth } from "@/lib/AuthContext"

interface ChannelDialogueProps {
  isopen: boolean
  onclose: () => void
  mode?: "create" | "edit"
  channeldata?: {
    name?: string
    description?: string
  }
  user?: {
    id?: string
    name?: string
  }
  onSuccess?: (channel: any) => void
}

export default function ChannelDialogue({
  isopen,
  onclose,
  mode = "create",
  channeldata,
  user: propUser,
  onSuccess,
}: ChannelDialogueProps) {
  const router = useRouter()
  const { user: authUser, login }: any = useAuth()
  const user = authUser || propUser

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    if (channeldata) {
      setFormData({
        name: channeldata.name || "",
        description: channeldata.description || "",
      })
    } else {
      setFormData({
        name: user?.name || "",
        description: "",
      })
    }
  }, [channeldata, user])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlesubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const payload = {
      channelname: formData.name,
      description: formData.description,
    }

    try {
      const targetId = user?._id || user?.id || "1"
      const response = await axiosInstance.post(
        `/user/update/${targetId}`,
        payload
      )
      if (login) {
        login(response?.data)
      }
      if (onSuccess) {
        onSuccess(response?.data)
      }
      onclose()
      router.push(`/channel/${response?.data?._id || targetId}`)
    } catch (error) {
      console.error("Error updating channel:", error)
      const fallbackChannel = {
        _id: user?._id || "1",
        id: user?._id || "1",
        name: formData.name,
        handle: `@${formData.name.toLowerCase().replace(/\s+/g, "")}`,
        description: formData.description,
      }
      if (login) login(fallbackChannel)
      if (onSuccess) onSuccess(fallbackChannel)
      onclose()
      router.push(`/channel/${fallbackChannel.id}`)
    }
  }

  return (
    <Dialog open={isopen} onOpenChange={(open) => !open && onclose()}>
      <DialogContent className="max-w-md border-neutral-800 bg-neutral-950 p-6 text-white sm:rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold text-white">
            {mode === "create" ? "Create your channel" : "Edit your channel"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handlesubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-xs font-medium text-neutral-300">
              Channel Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Channel name"
              className="mt-1.5 h-10 rounded-lg border-neutral-800 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-500 focus-visible:border-neutral-700 focus-visible:ring-0"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-xs font-medium text-neutral-300">
              Channel Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell viewers about your channel..."
              className="mt-1.5 min-h-[90px] resize-none rounded-lg border-neutral-800 bg-neutral-900 p-3 text-sm text-white placeholder:text-neutral-500 focus-visible:border-neutral-700 focus-visible:ring-0"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onclose}
              className="h-10 sm:h-9 w-full sm:w-auto rounded-lg border-neutral-700 bg-transparent px-4 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 sm:h-9 w-full sm:w-auto rounded-lg bg-red-600 hover:bg-red-700 sm:bg-neutral-800 sm:hover:bg-neutral-700 px-4 text-xs font-medium text-white"
            >
              {mode === "create" ? "Create Channel" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ChannelDialogue }
