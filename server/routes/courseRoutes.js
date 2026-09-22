import express from "express"
import {
  getAllCourses,
  getCourseById,
  getLessonById,
  createCourse,
} from "../controllers/courseController.js"

const router = express.Router()

router.get("/", getAllCourses)
router.get("/:id", getCourseById)
router.get("/:id/lesson/:lessonId", getLessonById)
router.post("/", createCourse)

export default router
