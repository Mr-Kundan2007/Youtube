import mongoose from "mongoose"
import Meeting from "../Modals/Meeting.js"
import MeetingParticipant from "../Modals/MeetingParticipant.js"
import User from "../Modals/Auth.js"

const inMemoryMeetings = new Map()
const inMemoryParticipants = new Map() // roomId -> Map(userId, participant)
const inMemoryChat = new Map() // roomId -> Array(messages)

export const meetingStore = {
  isDbConnected() {
    return Boolean(mongoose.connection && mongoose.connection.readyState === 1)
  },

  async findHostUser(userId) {
    if (this.isDbConnected() && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        return await User.findById(userId)
      } catch {
        return null
      }
    }
    return null
  },

  async isRoomIdTaken(roomId) {
    if (inMemoryMeetings.has(roomId)) return true
    if (this.isDbConnected()) {
      try {
        const found = await Meeting.findOne({ roomId })
        return Boolean(found)
      } catch {
        return false
      }
    }
    return false
  },

  async createMeeting(meetingData) {
    let meetingDoc = null
    if (this.isDbConnected()) {
      try {
        const newMeeting = new Meeting(meetingData)
        meetingDoc = await newMeeting.save()
      } catch (err) {
        console.warn("[MeetingStore] MongoDB save error, storing in-memory:", err.message)
      }
    }

    const meetingObj = meetingDoc
      ? (typeof meetingDoc.toObject === "function" ? meetingDoc.toObject() : meetingDoc)
      : {
          _id: new mongoose.Types.ObjectId().toString(),
          ...meetingData,
          coHosts: meetingData.coHosts || [],
          bannedUsers: meetingData.bannedUsers || [],
          isLocked: meetingData.isLocked || false,
          currentParticipantCount: 1,
          createdAt: new Date(),
          save: async function () {
            inMemoryMeetings.set(this.roomId, this)
            return this
          },
        }

    inMemoryMeetings.set(meetingData.roomId, meetingObj)
    return meetingObj
  },

  async findMeeting(roomId) {
    if (inMemoryMeetings.has(roomId)) {
      return inMemoryMeetings.get(roomId)
    }

    if (this.isDbConnected()) {
      try {
        const meeting = await Meeting.findOne({ roomId })
        if (meeting) {
          inMemoryMeetings.set(roomId, meeting)
          return meeting
        }
      } catch (err) {
        console.warn("[MeetingStore] MongoDB find error:", err.message)
      }
    }

    return null
  },

  async updateMeeting(roomId, update) {
    const existing = await this.findMeeting(roomId)
    if (!existing) return null

    if (this.isDbConnected() && typeof existing.save === "function" && existing._id) {
      try {
        return await Meeting.findOneAndUpdate({ roomId }, update, { new: true })
      } catch {}
    }

    const updated = { ...existing, ...update }
    inMemoryMeetings.set(roomId, updated)
    return updated
  },

  async upsertParticipant(roomId, userId, participantData) {
    if (this.isDbConnected()) {
      try {
        await MeetingParticipant.findOneAndUpdate(
          { roomId, userId },
          { $set: participantData },
          { upsert: true, new: true }
        )
      } catch (err) {
        console.warn("[MeetingStore] Participant upsert warning:", err.message)
      }
    }

    if (!inMemoryParticipants.has(roomId)) {
      inMemoryParticipants.set(roomId, new Map())
    }
    const roomParts = inMemoryParticipants.get(roomId)
    roomParts.set(userId, { ...participantData, roomId, userId })
  },

  async getParticipants(roomId) {
    if (this.isDbConnected()) {
      try {
        const list = await MeetingParticipant.find({ roomId, status: { $ne: "LEFT" } }).lean()
        if (list && list.length > 0) return list
      } catch {}
    }

    const roomParts = inMemoryParticipants.get(roomId)
    if (!roomParts) return []
    return Array.from(roomParts.values()).filter((p) => p.status !== "LEFT")
  },

  async findParticipant(roomId, userId) {
    if (this.isDbConnected()) {
      try {
        const part = await MeetingParticipant.findOne({ roomId, userId })
        if (part) return part
      } catch {}
    }

    const roomParts = inMemoryParticipants.get(roomId)
    return roomParts ? roomParts.get(userId) || null : null
  },

  addChatMessage(roomId, message) {
    if (!inMemoryChat.has(roomId)) {
      inMemoryChat.set(roomId, [])
    }
    inMemoryChat.get(roomId).push(message)
  },

  getChatHistory(roomId) {
    return inMemoryChat.get(roomId) || []
  },
}

export default meetingStore
