import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { FeedbackSessionsService } from '../../../services/feedback-sessions.service';
import { StatusMessageService } from '../../../services/status-message.service';
import {
  FeedbackMcqQuestionDetails,
  FeedbackMcqResponseDetails,
  FeedbackMsqQuestionDetails,
  FeedbackMsqResponseDetails,
  FeedbackQuestion,
  FeedbackQuestionType,
  QuestionOutput,
  ResponseOutput,
  SessionResults,
} from '../../../types/api-output';
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

  // MCQ-specific properties
  mcqAnswerFrequency: Record<string, number> = {};
  mcqPercentagePerOption: Record<string, number> = {};
  mcqChoices: string[] = [];

  // MSQ-specific properties
  msqAnswerFrequency: Record<string, number> = {};
  msqPercentagePerOption: Record<string, number> = {};
  msqChoices: string[] = [];
  msqTotalSelections = 0;
  msqAverageSelectionsPerResponse = 0;

  // Expose enum for template
  FeedbackQuestionType: typeof FeedbackQuestionType = FeedbackQuestionType;

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
            (q) => q.feedbackQuestion.feedbackQuestionId === this.question.feedbackQuestionId,
          );
          if (this.questionResult) {
            this.responses = this.questionResult.allResponses;
            this.calculateResponseRate();
            if (this.question.questionType === FeedbackQuestionType.MCQ) {
              this.calculateMcqStatistics();
            }
            if (this.question.questionType === FeedbackQuestionType.MSQ) {
              this.calculateMsqStatistics();
            }
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
    this.respondedCount = this.responses.filter((r) => !r.isMissingResponse).length;
    const totalRespondents = this.questionResult.allResponses.length;
    this.responseRate = (this.respondedCount / totalRespondents) * 100;
  }

  calculateMcqStatistics(): void {
    const mcqQuestion = this.question.questionDetails as FeedbackMcqQuestionDetails;
    this.mcqChoices = [...mcqQuestion.mcqChoices];
    
    // Initialize frequency counters
    this.mcqAnswerFrequency = {};
    for (const choice of mcqQuestion.mcqChoices) {
      this.mcqAnswerFrequency[choice] = 0;
    }
    if (mcqQuestion.otherEnabled) {
      this.mcqAnswerFrequency['Other'] = 0;
      this.mcqChoices.push('Other');
    }

    // Count responses (only non-missing responses)
    const validResponses = this.responses.filter((r) => !r.isMissingResponse);
    for (const response of validResponses) {
      const mcqResponse = response.responseDetails as FeedbackMcqResponseDetails;
      const key = mcqResponse.isOther ? 'Other' : mcqResponse.answer;
      if (Object.prototype.hasOwnProperty.call(this.mcqAnswerFrequency, key)) {
        this.mcqAnswerFrequency[key] += 1;
      }
    }

    // Calculate percentages
    this.mcqPercentagePerOption = {};
    const totalValidResponses = validResponses.length;
    for (const choice of this.mcqChoices) {
      const frequency = this.mcqAnswerFrequency[choice] || 0;
      const percentage = totalValidResponses > 0 ? (frequency / totalValidResponses) * 100 : 0;
      this.mcqPercentagePerOption[choice] = +percentage.toFixed(1);
    }
  }

  calculateMsqStatistics(): void {
    const msqQuestion = this.question.questionDetails as FeedbackMsqQuestionDetails;
    this.msqChoices = [...msqQuestion.msqChoices];

    // Initialize frequency counters
    this.msqAnswerFrequency = {};
    for (const choice of msqQuestion.msqChoices) {
      this.msqAnswerFrequency[choice] = 0;
    }
    if (msqQuestion.otherEnabled) {
      this.msqAnswerFrequency['Other'] = 0;
      this.msqChoices.push('Other');
    }

    // Count responses (only non-missing responses)
    const validResponses = this.responses.filter((r) => !r.isMissingResponse);
    this.msqTotalSelections = 0;

    for (const response of validResponses) {
      const msqResponse = response.responseDetails as FeedbackMsqResponseDetails;

      // Count all selected answers for this response
      for (const answer of msqResponse.answers) {
        if (Object.prototype.hasOwnProperty.call(this.msqAnswerFrequency, answer)) {
          this.msqAnswerFrequency[answer] += 1;
          this.msqTotalSelections += 1;
        }
      }

      // Count "Other" selections if enabled and present
      if (msqResponse.isOther && msqQuestion.otherEnabled) {
        this.msqAnswerFrequency['Other'] += 1;
        this.msqTotalSelections += 1;
      }
    }

    // Calculate percentages and average selections
    this.msqPercentagePerOption = {};
    const totalValidResponses = validResponses.length;
    this.msqAverageSelectionsPerResponse = totalValidResponses > 0
      ? +(this.msqTotalSelections / totalValidResponses).toFixed(1) : 0;

    for (const choice of this.msqChoices) {
      const frequency = this.msqAnswerFrequency[choice] || 0;
      const percentage = totalValidResponses > 0 ? (frequency / totalValidResponses) * 100 : 0;
      this.msqPercentagePerOption[choice] = +percentage.toFixed(1);
    }
  }
}
