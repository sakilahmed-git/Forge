import { AttendanceModel } from './attendance.model'
import { MarksModel } from './marks.model'
import { StudentModel } from './student.model'

export class Database {
  private attendanceModel: AttendanceModel
  private marksModel: MarksModel
  private studentModel: StudentModel

  constructor() {
    this.attendanceModel = new AttendanceModel()
    this.marksModel = new MarksModel()
    this.studentModel = new StudentModel()
  }

  async connect(): Promise<void> {
    try {
      // implement database connection logic here
    } catch (error) {
      // handle error
    }
  }

  async queryDatabase(): Promise<void> {
    try {
      await this.attendanceModel.queryDatabase()
      await this.marksModel.queryDatabase()
      await this.studentModel.queryDatabase()
    } catch (error) {
      // handle error
    }
  }

  async getStudent(id: string): Promise<any> {
    try {
      return await this.studentModel.queryDatabase(id)
    } catch (error) {
      // handle error
    }
  }

  async getAttendance(id: string): Promise<any> {
    try {
      return await this.attendanceModel.queryDatabase(id)
    } catch (error) {
      // handle error
    }
  }

  async getMarks(id: string): Promise<any> {
    try {
      return await this.marksModel.queryDatabase(id)
    } catch (error) {
      // handle error
    }
  }
}