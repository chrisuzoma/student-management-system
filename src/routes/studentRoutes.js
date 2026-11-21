import express from 'express';
import {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController.js';

const router = express.Router();

router.get('/', getAllStudents);
router.get('/:reg_no', getStudentById);
router.post('/', createStudent);
router.put('/:reg_no', updateStudent);
router.delete('/:reg_no', deleteStudent);

export default router;