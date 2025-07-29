import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { FeedbackQuestionsService } from '../../../services/feedback-questions.service';
import { FeedbackSessionsService } from '../../../services/feedback-sessions.service';
import { StatusMessageService } from '../../../services/status-message.service';
import { FeedbackQuestion, FeedbackQuestions, FeedbackSession } from '../../../types/api-output';
import { Intent } from '../../../types/api-request';
import { ErrorMessageOutput } from '../../error-message-output';
import { collapseAnim } from '../../components/teammates-common/collapse-anim';

export interface FeedbackQuestionAnalyticsModel {
  question: FeedbackQuestion;
  isTabExpanded: boolean;
}

@Component({
  selector: 'tm-instructor-session-analytics-page',
  templateUrl: './instructor-session-analytics-page.component.html',
  styleUrls: ['./instructor-session-analytics-page.component.scss'],
  animations: [collapseAnim],
})
export class InstructorSessionAnalyticsPageComponent implements OnInit {
  courseId = '';
  fsName = '';
  session?: FeedbackSession;
  questions: FeedbackQuestionAnalyticsModel[] = [];

  isLoading = true;
  hasLoadingFailed = false;

  constructor(
    private route: ActivatedRoute,
    private feedbackSessionsService: FeedbackSessionsService,
    private feedbackQuestionsService: FeedbackQuestionsService,
    private statusMessageService: StatusMessageService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((queryParams) => {
      this.courseId = queryParams['courseid'];
      this.fsName = queryParams['fsname'];
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading = true;
    this.hasLoadingFailed = false;

    this.feedbackSessionsService
      .getFeedbackSession({
        courseId: this.courseId,
        feedbackSessionName: this.fsName,
        intent: Intent.INSTRUCTOR_RESULT,
      })
      .subscribe({
        next: (session: FeedbackSession) => {
          this.session = session;
          this.loadQuestions();
        },
        error: (err: ErrorMessageOutput) => {
          this.isLoading = false;
          this.hasLoadingFailed = true;
          this.statusMessageService.showErrorToast(err.error.message);
        },
      });
  }

  loadQuestions(): void {
    this.feedbackQuestionsService
      .getFeedbackQuestions({
        courseId: this.courseId,
        feedbackSessionName: this.fsName,
        intent: Intent.FULL_DETAIL,
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (feedbackQuestions: FeedbackQuestions) => {
          this.questions = feedbackQuestions.questions
            .sort((a, b) => a.questionNumber - b.questionNumber)
            .map((q) => ({
              question: q,
              isTabExpanded: false,
            }));
        },
        error: (err: ErrorMessageOutput) => {
          this.hasLoadingFailed = true;
          this.statusMessageService.showErrorToast(err.error.message);
        },
      });
  }

  toggleQuestionTab(questionModel: FeedbackQuestionAnalyticsModel): void {
    questionModel.isTabExpanded = !questionModel.isTabExpanded;
  }

  retryLoadData(): void {
    this.loadData();
  }
}