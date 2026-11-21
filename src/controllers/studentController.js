import { pool } from '../config/database.js';

export const getAllStudents = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY reg_no');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { reg_no } = req.params;
    const result = await pool.query('SELECT * FROM students WHERE reg_no = $1', [reg_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createStudent = async (req, res) => {
  try {
    const { reg_no, name, email } = req.body;

    if (!reg_no || !name || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await pool.query(
      'INSERT INTO students (reg_no, name, email) VALUES ($1, $2, $3) RETURNING *',
      [reg_no, name, email]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Reg number or email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { reg_no } = req.params;
    const { name, email } = req.body;

    const result = await pool.query(
      'UPDATE students SET name = $1, email = $2 WHERE reg_no = $3 RETURNING *',
      [name, email, reg_no]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { reg_no } = req.params;
    const result = await pool.query('DELETE FROM students WHERE reg_no = $1 RETURNING *', [reg_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};