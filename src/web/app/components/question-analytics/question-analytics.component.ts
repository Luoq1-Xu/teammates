import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { FeedbackSessionsService } from '../../../services/feedback-sessions.service';
import { StatusMessageService } from '../../../services/status-message.service';
import { FeedbackQuestion, QuestionOutput, ResponseOutput, SessionResults } from '../../../types/api-output';
import { Intent } from '../../../types/api-request';
import { ErrorMessageOutput } from '../../error-message-output';


@Component({
  selector: 'tm-question-analytics',
  templateUrl: './question-analytics.component.html',
})
export class QuestionAnalyticsComponent implements OnChanges {
  @Input() question!: FeedbackQuestion;
  @Input() courseId!: string;
  @Input() fsName!: string;

  responses: ResponseOutput[] = [];
  respondedCount = 0;
  isLoading = true;
  hasLoadingFailed = false;
  responseRate = 0;
  questionResult?: QuestionOutput;

  constructor(
    private feedbackSessionsService: FeedbackSessionsService,
    private statusMessageService: StatusMessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['question'] && changes['question'].currentValue) {
      this.loadResponses();
    }
  }

  loadResponses(): void {
    this.isLoading = true;
    this.hasLoadingFailed = false;
    this.feedbackSessionsService
      .getFeedbackSessionResults({
        courseId: this.courseId,
        feedbackSessionName: this.fsName,
        intent: Intent.FULL_DETAIL,
        questionId: this.question.feedbackQuestionId,
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (results: SessionResults) => {
          this.questionResult = results.questions.find(
            (q) => q.feedbackQuestion.feedbackQuestionId === this.question.feedbackQuestionId
          );
          if (this.questionResult) {
            this.responses = this.questionResult.allResponses;
            this.calculateResponseRate();
          }
        },
        error: (err: ErrorMessageOutput) => {
          this.hasLoadingFailed = true;
          this.statusMessageService.showErrorToast(err.error.message);
        },
      });
  }

  calculateResponseRate(): void {
    if (!this.questionResult || this.questionResult.allResponses.length === 0) {
      this.responseRate = 0;
      this.respondedCount = 0;
      return;
    }
    this.respondedCount = this.responses.filter(r => !r.isMissingResponse).length;
    const totalRespondents = this.questionResult.allResponses.length;
    this.responseRate = (this.respondedCount / totalRespondents) * 100;
  }
}