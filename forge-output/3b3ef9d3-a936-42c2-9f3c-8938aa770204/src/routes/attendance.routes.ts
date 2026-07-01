export const attendanceRoutes = async () => {
  try {
    const { login } = await import('src/auth/auth.js');
    const db = await import('src/db/db.js');
    const attendanceData = await db.getAttendance('id');
    if (!attendanceData) {
      throw new Error('Error fetching attendance data');
    }
    return attendanceData;
  } catch (error) {
    throw new Error(`Error fetching attendance data: ${error.message}`);
  }
};