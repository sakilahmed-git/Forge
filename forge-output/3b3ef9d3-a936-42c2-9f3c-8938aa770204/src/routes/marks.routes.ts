import { login } from 'src/auth/auth.js';
import db from 'src/db/db.js';

export const marksRoutes = async (app: any) => {
  try {
    // Student routes
    app.get('/student/:id', login, async (req: any, res: any) => {
      try {
        const studentId = req.params.id;
        const student = await db.getStudent(studentId);
        res.json(student);
      } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching student' });
      }
    });

    // Attendance routes
    app.get('/attendance/:id', login, async (req: any, res: any) => {
      try {
        const studentId = req.params.id;
        const attendance = await db.getAttendance(studentId);
        res.json(attendance);
      } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching attendance' });
      }
    });

    // Marks routes
    app.get('/marks/:id', login, async (req: any, res: any) => {
      try {
        const studentId = req.params.id;
        const marks = await db.getMarks(studentId);
        res.json(marks);
      } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching marks' });
      }
    });
  } catch (error: any) {
    console.error(error);
  }
};