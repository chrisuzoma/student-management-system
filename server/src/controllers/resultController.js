import { pool } from '../config/database.js';

export const getAllResults = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT r.*, s.name as student_name, c.title as course_title FROM results r JOIN students s ON r.student_id = s.reg_no JOIN courses c ON r.course_id = c.id ORDER BY r.id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getResultById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT r.*, s.name as student_name, c.title as course_title FROM results r JOIN students s ON r.student_id = s.reg_no JOIN courses c ON r.course_id = c.id WHERE r.id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createResult = async (req, res) => {
  try {
    const { student_id, course_id, marks_obtained, total_marks } = req.body;

    if (!student_id || !course_id || marks_obtained === undefined || total_marks === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if student and course exist
    const studentResult = await pool.query('SELECT * FROM students WHERE reg_no = $1', [student_id]);
    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [course_id]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if result already exists for this student-course combination
    const existingResult = await pool.query(
      'SELECT * FROM results WHERE student_id = $1 AND course_id = $2',
      [student_id, course_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Result already exists for this student and course' });
    }

    const result = await pool.query(
      'INSERT INTO results (student_id, course_id, marks_obtained, total_marks) VALUES ($1, $2, $3, $4) RETURNING *',
      [student_id, course_id, marks_obtained, total_marks]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks_obtained, total_marks } = req.body;

    const result = await pool.query(
      'UPDATE results SET marks_obtained = $1, total_marks = $2 WHERE id = $3 RETURNING *',
      [marks_obtained, total_marks, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM results WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json({ message: 'Result deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};