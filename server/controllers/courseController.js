import Course from "../Modals/Course.js"
import subscriptionAccessControlService from "../services/subscriptionAccessControlService.js"
import jwt from "jsonwebtoken"
import { authConfig } from "../config/index.js"

const getUserIdFromReq = (req) => {
  let userId = req.user?.id || req.user?._id || null
  if (!userId && req.headers.authorization?.startsWith("Bearer ")) {
    try {
      const token = req.headers.authorization.split(" ")[1]
      const decoded = jwt.verify(token, authConfig.jwtSecret)
      userId = decoded.id || decoded._id
    } catch (e) {}
  }
  return userId
}

/**
 * GET /api/courses
 */
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 }).lean()
    return res.status(200).json({ success: true, data: { courses } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/courses/:id
 */
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params
    const course = await Course.findById(id).lean()
    if (!course) {
      return res.status(404).json({ success: false, code: "COURSE_NOT_FOUND", message: "Course not found" })
    }

    const userId = getUserIdFromReq(req)
    const check = await subscriptionAccessControlService.canAccessCourse(userId, course)

    if (!check.allowed) {
      // Filter out non-preview lessons for unentitled users
      const previewLessons = (course.lessons || []).filter((l) => l.isPreview)
      return res.status(check.code === "AUTHENTICATION_REQUIRED" ? 401 : 403).json({
        success: false,
        code: check.code || "SUBSCRIPTION_REQUIRED",
        message: check.message || "Course requires subscription access",
        requiredPlan: check.requiredPlan,
        currentPlan: check.currentPlan,
        upgradeAvailable: true,
        data: {
          ...course,
          lessons: previewLessons,
          isLocked: true,
        },
      })
    }

    return res.status(200).json({ success: true, data: { ...course, isLocked: false } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/courses/:id/lesson/:lessonId
 */
export const getLessonById = async (req, res) => {
  try {
    const { id, lessonId } = req.params
    const course = await Course.findById(id).lean()
    if (!course) {
      return res.status(404).json({ success: false, code: "COURSE_NOT_FOUND", message: "Course not found" })
    }

    const lesson = (course.lessons || []).find((l) => String(l._id) === String(lessonId))
    if (!lesson) {
      return res.status(404).json({ success: false, code: "LESSON_NOT_FOUND", message: "Lesson not found" })
    }

    // Previews are free
    if (lesson.isPreview) {
      return res.status(200).json({ success: true, data: { lesson } })
    }

    const userId = getUserIdFromReq(req)
    const check = await subscriptionAccessControlService.canAccessCourse(userId, course)

    if (!check.allowed) {
      return res.status(check.code === "AUTHENTICATION_REQUIRED" ? 401 : 403).json({
        success: false,
        code: check.code || "SUBSCRIPTION_REQUIRED",
        message: check.message || "Subscription required to view this lesson",
        requiredPlan: check.requiredPlan,
        currentPlan: check.currentPlan,
        upgradeAvailable: true,
      })
    }

    return res.status(200).json({ success: true, data: { lesson } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/courses (Creation helper)
 */
export const createCourse = async (req, res) => {
  try {
    const course = await Course.create(req.body)
    return res.status(201).json({ success: true, data: { course } })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export default {
  getAllCourses,
  getCourseById,
  getLessonById,
  createCourse,
}
