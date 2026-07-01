export const studentRoutes = async () => {
  try {
    const { login } = await import('src/auth/auth.js');
    const db = await import('src/db/db.js');
    const studentData = await db.getStudent('id');
    const marksData = await db.getMarks('id');
    if (!studentData || !marksData) {
      throw new Error('Error fetching student or marks data');
    }
    return { studentData, marksData };
  } catch (error) {
    throw new Error(`Error fetching student data: ${error.message}`);
  }
};