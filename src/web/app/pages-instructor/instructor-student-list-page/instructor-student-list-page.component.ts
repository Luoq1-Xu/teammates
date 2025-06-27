import { HttpStatusCode } from '@angular/common/http';
import { Component, OnInit, ViewChildren, QueryList, ElementRef, HostListener } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { CourseService, CourseStatistics } from '../../../services/course.service';
import { InstructorService } from '../../../services/instructor.service';
import { StatusMessageService } from '../../../services/status-message.service';
import { StudentService } from '../../../services/student.service';
import { TableComparatorService } from '../../../services/table-comparator.service';
import {
  Course,
  Courses,
  InstructorPermissionSet,
  InstructorPrivilege,
  Student,
  Students,
} from '../../../types/api-output';
import { SortBy, SortOrder } from '../../../types/sort-properties';
import { JoinStatePipe } from '../../components/student-list/join-state.pipe';
import { StudentListRowModel } from '../../components/student-list/student-list.component';
import { collapseAnim } from '../../components/teammates-common/collapse-anim';
import { ErrorMessageOutput } from '../../error-message-output';

interface StudentIndexedData {
  [key: string]: Student[];
}

export interface CourseTab {
  course: Course;
  studentList: StudentListRowModel[];
  filteredStudentList?: StudentListRowModel[];
  lastSectionFilter?: string;
  lastTeamFilter?: string;
  studentSortBy: SortBy;
  studentSortOrder: SortOrder;
  hasTabExpanded: boolean;
  hasStudentLoaded: boolean;
  hasLoadingFailed: boolean;
  isAbleToViewStudents: boolean;
  stats: CourseStatistics;
  sectionList: string[];
  teamList: string[];
  selectedSections: string[];
  selectedTeams: string[];
  isSectionsDropdownOpen: boolean;
  isTeamsDropdownOpen: boolean;
}

/**
 * Instructor student list page.
 */
@Component({
  selector: 'tm-instructor-student-list-page',
  templateUrl: './instructor-student-list-page.component.html',
  styleUrls: ['./instructor-student-list-page.component.scss'],
  animations: [collapseAnim],
})
export class InstructorStudentListPageComponent implements OnInit {
  @ViewChildren('sectionsDropdownContainer') sectionsDropdownContainers!: QueryList<ElementRef>;
  @ViewChildren('teamsDropdownContainer') teamsDropdownContainers!: QueryList<ElementRef>;

  courseTabList: CourseTab[] = [];
  hasLoadingFailed: boolean = false;
  isLoadingCourses: boolean = false;

  // enum
  SortBy: typeof SortBy = SortBy;

  coursesSortBy: SortBy = SortBy.COURSE_CREATION_DATE;

  constructor(private instructorService: InstructorService,
              private courseService: CourseService,
              private studentService: StudentService,
              private statusMessageService: StatusMessageService,
              private tableComparatorService: TableComparatorService) {
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    // Close all dropdowns when clicking outside
    this.courseTabList.forEach(courseTab => {
      courseTab.isSectionsDropdownOpen = false;
      courseTab.isTeamsDropdownOpen = false;
    });
  }

  ngOnInit(): void {
    this.loadCourses();
  }

  /**
   * Loads courses of current instructor.
   */
  loadCourses(): void {
    this.hasLoadingFailed = false;
    this.isLoadingCourses = true;
    this.courseService.getAllCoursesAsInstructor('active')
        .pipe(finalize(() => {
          this.isLoadingCourses = false;
        }))
        .subscribe({
          next: (courses: Courses) => {
            courses.courses.forEach((course: Course) => {
              const courseTab: CourseTab = {
                course,
                studentList: [],
                studentSortBy: SortBy.NONE,
                studentSortOrder: SortOrder.ASC,
                hasTabExpanded: false,
                hasStudentLoaded: false,
                hasLoadingFailed: false,
                isAbleToViewStudents: true,
                stats: {
                  numOfSections: 0,
                  numOfStudents: 0,
                  numOfTeams: 0,
                },
                sectionList: [],
                teamList: [],
                selectedSections: [],
                selectedTeams: [],
                isSectionsDropdownOpen: false,
                isTeamsDropdownOpen: false
              };

              this.courseTabList.push(courseTab);
            });
          },
          error: (resp: ErrorMessageOutput) => {
            this.courseTabList = [];
            this.hasLoadingFailed = true;
            this.statusMessageService.showErrorToast(resp.error.message);
          },
          complete: () => this.sortCourses(this.coursesSortBy),
        });
  }

  /**
   * Toggles the sections dropdown for a course tab.
   */
  toggleSectionsDropdown(courseTab: CourseTab): void {
    const wasOpen = courseTab.isSectionsDropdownOpen;
    courseTab.isTeamsDropdownOpen = false;
    courseTab.isSectionsDropdownOpen = !wasOpen;
  }

  /**
   * Toggles the teams dropdown for a course tab.
   */
  toggleTeamsDropdown(courseTab: CourseTab): void {
    const wasOpen = courseTab.isTeamsDropdownOpen;
    courseTab.isSectionsDropdownOpen = false;
    courseTab.isTeamsDropdownOpen = !wasOpen;
  }

  /**
   * Toggles specific card and loads students if needed
   */
  toggleCard(courseTab: CourseTab): void {
    courseTab.hasTabExpanded = !courseTab.hasTabExpanded;
    if (!courseTab.hasStudentLoaded) {
      this.loadStudents(courseTab);
    }
  }

  /**
   * Loads students of a specified course.
   */
  loadStudents(courseTab: CourseTab): void {
    courseTab.hasLoadingFailed = false;
    courseTab.hasStudentLoaded = false;
    this.studentService.getStudentsFromCourse({ courseId: courseTab.course.courseId })
        .subscribe({
          next: (students: Students) => {
            courseTab.studentList = []; // Reset the list of students for the course

            // Extract unique sections and teams
            const uniqueSections = new Set<string>();
            const uniqueTeams = new Set<string>();

            students.students.forEach((student: Student) => {
              uniqueSections.add(student.sectionName);
              uniqueTeams.add(student.teamName);
            });
            
            courseTab.sectionList = Array.from(uniqueSections).sort();
            courseTab.teamList = Array.from(uniqueTeams).sort();
            courseTab.selectedSections = [];
            courseTab.selectedTeams = [];

            const sections: StudentIndexedData = students.students.reduce((acc: StudentIndexedData, x: Student) => {
              const term: string = x.sectionName;
              (acc[term] = acc[term] || []).push(x);
              return acc;
            }, {});

            this.instructorService.loadInstructorPrivilege({
              courseId: courseTab.course.courseId,
            })
                .pipe(finalize(() => {
                  courseTab.hasStudentLoaded = true;
                }))
                .subscribe({
                  next: (instructorPrivilege: InstructorPrivilege) => {
                    const courseLevelPrivilege: InstructorPermissionSet = instructorPrivilege.privileges.courseLevel;

                    Object.keys(sections).forEach((sectionName: string) => {
                      const sectionLevelPrivilege: InstructorPermissionSet =
                          instructorPrivilege.privileges.sectionLevel[sectionName] || courseLevelPrivilege;

                      const studentsInSection: Student[] = sections[sectionName];
                      const studentModels: StudentListRowModel[] = studentsInSection.map((stuInSection: Student) => {
                        return {
                          student: stuInSection,
                          isAllowedToViewStudentInSection: sectionLevelPrivilege.canViewStudentInSections,
                          isAllowedToModifyStudent: sectionLevelPrivilege.canModifyStudent,
                        };
                      });

                      courseTab.studentList.push(...studentModels);
                      courseTab.studentList.sort(this.sortStudentBy(SortBy.NONE, SortOrder.ASC));
                    });

                    courseTab.stats = this.courseService.calculateCourseStatistics(students.students);
                    this.updateFilteredStudentList(courseTab); // Initialize filtered list

                  },
                  error: (resp: ErrorMessageOutput) => {
                    courseTab.hasLoadingFailed = true;
                    courseTab.studentList = [];
                    this.statusMessageService.showErrorToast(resp.error.message);
                  },
                });
          },
          error: (resp: ErrorMessageOutput) => {
            if (resp.status === HttpStatusCode.Forbidden) {
              courseTab.isAbleToViewStudents = false;
              courseTab.hasStudentLoaded = true;
            } else {
              courseTab.hasLoadingFailed = true;
            }
            courseTab.studentList = [];
            this.statusMessageService.showErrorToast(resp.error.message);
          },
        });
  }

  /**
   * Removes the student from course and update the course statistics.
   */
  removeStudentFromCourse(courseTab: CourseTab, studentEmail: string): void {
    this.courseService.removeStudentFromCourse(courseTab.course.courseId, studentEmail).subscribe({
      next: () => {
        courseTab.studentList =
            courseTab.studentList.filter(
                (studentModel: StudentListRowModel) => studentModel.student.email !== studentEmail);

        const students: Student[] =
            courseTab.studentList.map((studentModel: StudentListRowModel) => studentModel.student);
        courseTab.stats = this.courseService.calculateCourseStatistics(students);
        this.updateFilteredStudentList(courseTab); // Update filtered list after removal

        this.statusMessageService
            .showSuccessToast(`Student is successfully deleted from course "${courseTab.course.courseId}"`);
      },
      error: (resp: ErrorMessageOutput) => {
        this.statusMessageService.showErrorToast(resp.error.message);
      },
    });
  }

  /**
   * Checks the option selected to sort courses.
   */
  isSelectedForSorting(by: SortBy): boolean {
    return this.coursesSortBy === by;
  }

  /**
   * Sorts the courses in the list according to selected option.
   */
  sortCourses(by: SortBy): void {
    this.coursesSortBy = by;

    if (this.courseTabList.length > 1) {
      const coursesCopy: CourseTab[] = JSON.parse(JSON.stringify(this.courseTabList));
      coursesCopy.sort(this.sortCoursesBy(by));
      this.courseTabList = coursesCopy;
    }
  }

  /**
   * Returns a function to determine the order of sort for courses.
   */
  sortCoursesBy(by: SortBy):
    ((a: { course: Course }, b: { course: Course }) => number) {
    return ((a: { course: Course }, b: { course: Course }): number => {
      let strA: string;
      let strB: string;
      let order: SortOrder;
      switch (by) {
        case SortBy.COURSE_NAME:
          strA = a.course.courseName;
          strB = b.course.courseName;
          order = SortOrder.ASC;
          break;
        case SortBy.COURSE_ID:
          strA = a.course.courseId;
          strB = b.course.courseId;
          order = SortOrder.ASC;
          break;
        case SortBy.COURSE_CREATION_DATE:
          strA = String(a.course.creationTimestamp);
          strB = String(b.course.creationTimestamp);
          order = SortOrder.DESC;
          break;
        default:
          strA = '';
          strB = '';
          order = SortOrder.ASC;
      }
      return this.tableComparatorService.compare(by, order, strA, strB);
    });
  }

  /**
   * Sorts the student list.
   */
  sortStudentList(courseTab: CourseTab, by: SortBy): void {
    courseTab.studentSortBy = by;
    courseTab.studentSortOrder =
      courseTab.studentSortOrder === SortOrder.DESC ? SortOrder.ASC : SortOrder.DESC;
    courseTab.studentList.sort(this.sortStudentBy(by, courseTab.studentSortOrder));
  }

  /**
   * Returns a function to determine the order of sort for students.
   */
  sortStudentBy(by: SortBy, order: SortOrder):
      ((a: StudentListRowModel, b: StudentListRowModel) => number) {
    const joinStatePipe: JoinStatePipe = new JoinStatePipe();
    if (by === SortBy.NONE) {
      // Default order: section name > team name > student name
      return ((a: StudentListRowModel, b: StudentListRowModel): number => {
        return this.tableComparatorService
            .compare(SortBy.SECTION_NAME, order, a.student.sectionName, b.student.sectionName)
          || this.tableComparatorService.compare(SortBy.TEAM_NAME, order, a.student.teamName, b.student.teamName)
          || this.tableComparatorService.compare(SortBy.RESPONDENT_NAME, order, a.student.name, b.student.name);
      });
    }
    return (a: StudentListRowModel, b: StudentListRowModel): number => {
      let strA: string;
      let strB: string;
      switch (by) {
        case SortBy.SECTION_NAME:
          strA = a.student.sectionName;
          strB = b.student.sectionName;
          break;
        case SortBy.RESPONDENT_NAME:
          strA = a.student.name;
          strB = b.student.name;
          break;
        case SortBy.TEAM_NAME:
          strA = a.student.teamName;
          strB = b.student.teamName;
          break;
        case SortBy.RESPONDENT_EMAIL:
          strA = a.student.email;
          strB = b.student.email;
          break;
        case SortBy.JOIN_STATUS:
          strA = joinStatePipe.transform(a.student.joinState);
          strB = joinStatePipe.transform(b.student.joinState);
          break;
        default:
          strA = '';
          strB = '';
      }

      return this.tableComparatorService.compare(by, order, strA, strB);
    };
  }

  /**
   * Initializes a new CourseTab with default values.
   */
  initializeCourseTab(course: Course): CourseTab {
    return {
      course,
      studentList: [],
      studentSortBy: SortBy.NONE,
      studentSortOrder: SortOrder.ASC,
      hasTabExpanded: false,
      hasStudentLoaded: false,
      hasLoadingFailed: false,
      isAbleToViewStudents: true,
      stats: {
        numOfSections: 0,
        numOfStudents: 0,
        numOfTeams: 0,
      },
      sectionList: [],
      teamList: [],
      selectedSections: [],
      selectedTeams: [],
      isSectionsDropdownOpen: false,
      isTeamsDropdownOpen: false,
    };
  }

  /**
   * Toggles the selection of a section for filtering.
   */
  toggleSectionSelection(courseTab: CourseTab, section: string): void {
    const index = courseTab.selectedSections.indexOf(section);
    if (index === -1) {
      // Add section to selected sections
      courseTab.selectedSections = [...courseTab.selectedSections, section];
    } else {
      // Remove section from selected sections
      courseTab.selectedSections = courseTab.selectedSections.filter(s => s !== section);
    }
    this.updateFilteredStudentList(courseTab);
  }

  /**
   * Toggles the selection of a team for filtering.
   */
  toggleTeamSelection(courseTab: CourseTab, team: string): void {
    const index = courseTab.selectedTeams.indexOf(team);
    if (index === -1) {
      // Add team to selected teams
      courseTab.selectedTeams = [...courseTab.selectedTeams, team];
    } else {
      // Remove team from selected teams
      courseTab.selectedTeams = courseTab.selectedTeams.filter(t => t !== team);
    }
    this.updateFilteredStudentList(courseTab);
  }

  /**
   * Checks if a section is selected.
   */
  isSectionSelected(courseTab: CourseTab, section: string): boolean {
    return courseTab.selectedSections.includes(section);
  }

  /**
   * Checks if a team is selected.
   */
  isTeamSelected(courseTab: CourseTab, team: string): boolean {
    return courseTab.selectedTeams.includes(team);
  }

  /**
   * Clears all section selections.
   */
  clearSectionSelections(courseTab: CourseTab): void {
    courseTab.selectedSections = [];
    this.updateFilteredStudentList(courseTab);
  }

  /**
   * Clears all team selections.
   */
  clearTeamSelections(courseTab: CourseTab): void {
    courseTab.selectedTeams = [];
    this.updateFilteredStudentList(courseTab);
  }

  /**
   * Forces an update to the student list to make filtering work.
   */
  private updateFilteredStudentList(courseTab: CourseTab): void {
    courseTab.filteredStudentList = this.getFilteredStudentList(courseTab);
  }

  /**
   * Returns a filtered list of students based on selected sections and teams.
   */
  getFilteredStudentList(courseTab: CourseTab): StudentListRowModel[] {
    // If no filters are applied, return all students
    if (courseTab.selectedSections.length === 0 && courseTab.selectedTeams.length === 0) {
      // Always create a NEW array reference to trigger change detection
      return [...courseTab.studentList];
    }
    
    // Apply filters
    const filtered = courseTab.studentList.filter(studentRow => {
      // Check if student's section matches any selected section
      const sectionMatches = courseTab.selectedSections.length === 0 || 
                            courseTab.selectedSections.includes(studentRow.student.sectionName);
                            
      // Check if student's team matches any selected team
      const teamMatches = courseTab.selectedTeams.length === 0 || 
                        courseTab.selectedTeams.includes(studentRow.student.teamName);
                        
      return sectionMatches && teamMatches;
    });
    
    return [...filtered];
  }
}
