import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { FeedbackSessionsService } from '../../../services/feedback-sessions.service';
import { StatusMessageService } from '../../../services/status-message.service';
import {
  FeedbackConstantSumQuestionDetails,
  FeedbackConstantSumResponseDetails,
  FeedbackContributionResponseDetails,
  FeedbackMcqQuestionDetails,
  FeedbackMcqResponseDetails,
  FeedbackMsqQuestionDetails,
  FeedbackMsqResponseDetails,
  FeedbackNumericalScaleResponseDetails,
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

  // NUMSCALE-specific properties
  numscaleValues: number[] = [];
  numscaleAverage = 0;
  numscaleMedian = 0;
  numscaleMin = 0;
  numscaleMax = 0;
  numscaleStdDev = 0;
  numscaleDistribution: Record<number, number> = {};

  // CONSTSUM-specific properties
  constsumOptions: string[] = [];
  constsumAveragePerOption: Record<string, number> = {};
  constsumTotalPointsDistributed = 0;
  constsumAveragePointsPerResponse = 0;

  // CONTRIB-specific properties
  contribValues: number[] = [];
  contribAverage = 0;
  contribMedian = 0;
  contribMin = 0;
  contribMax = 0;
  contribStdDev = 0;
  contribDistribution: Record<number, number> = {};

  // Expose enum for template
  FeedbackQuestionType: typeof FeedbackQuestionType = FeedbackQuestionType;

  // Helper function for keyvalue pipe to preserve original order
  originalOrder = (): number => 0;

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
            if (this.question.questionType === FeedbackQuestionType.NUMSCALE) {
              this.calculateNumscaleStatistics();
            }
            if (this.question.questionType === FeedbackQuestionType.CONSTSUM) {
              this.calculateConstsumStatistics();
            }
            if (this.question.questionType === FeedbackQuestionType.CONSTSUM_OPTIONS) {
              this.calculateConstsumStatistics();
            }
            if (this.question.questionType === FeedbackQuestionType.CONSTSUM_RECIPIENTS) {
              this.calculateConstsumStatistics();
            }
            if (this.question.questionType === FeedbackQuestionType.CONTRIB) {
              this.calculateContribStatistics();
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

  calculateNumscaleStatistics(): void {
    const validResponses = this.responses.filter((r) => !r.isMissingResponse);
    this.numscaleValues = validResponses.map((response) => {
      const numscaleResponse = response.responseDetails as FeedbackNumericalScaleResponseDetails;
      return numscaleResponse.answer;
    });

    if (this.numscaleValues.length === 0) {
      this.numscaleAverage = 0;
      this.numscaleMedian = 0;
      this.numscaleMin = 0;
      this.numscaleMax = 0;
      this.numscaleStdDev = 0;
      this.numscaleDistribution = {};
      return;
    }

    // Calculate basic statistics
    const sortedValues = [...this.numscaleValues].sort((a, b) => a - b);
    this.numscaleMin = sortedValues[0];
    this.numscaleMax = sortedValues[sortedValues.length - 1];

    // Calculate average
    const sum = this.numscaleValues.reduce((acc, val) => acc + val, 0);
    this.numscaleAverage = +(sum / this.numscaleValues.length).toFixed(2);

    // Calculate median
    const mid = Math.floor(sortedValues.length / 2);
    this.numscaleMedian = sortedValues.length % 2 === 0
      ? +((sortedValues[mid - 1] + sortedValues[mid]) / 2).toFixed(2)
      : sortedValues[mid];

    // Calculate standard deviation
    const variance = this.numscaleValues.reduce((acc, val) => acc + Math.pow(val - this.numscaleAverage, 2), 0) / this.numscaleValues.length;
    this.numscaleStdDev = +Math.sqrt(variance).toFixed(2);

    // Calculate distribution
    this.numscaleDistribution = {};
    for (const value of this.numscaleValues) {
      this.numscaleDistribution[value] = (this.numscaleDistribution[value] || 0) + 1;
    }
  }

  calculateConstsumStatistics(): void {
    const constsumQuestion = this.question.questionDetails as FeedbackConstantSumQuestionDetails;
    this.constsumOptions = [...constsumQuestion.constSumOptions];

    // Initialize averages
    this.constsumAveragePerOption = {};
    for (const option of this.constsumOptions) {
      this.constsumAveragePerOption[option] = 0;
    }

    const validResponses = this.responses.filter((r) => !r.isMissingResponse);
    if (validResponses.length === 0) {
      this.constsumTotalPointsDistributed = 0;
      this.constsumAveragePointsPerResponse = 0;
      return;
    }

    let totalPointsAcrossAllResponses = 0;
    const optionTotals: Record<string, number> = {};

    // Initialize option totals
    for (const option of this.constsumOptions) {
      optionTotals[option] = 0;
    }

    // Sum up all points for each option across all responses
    for (const response of validResponses) {
      const constsumResponse = response.responseDetails as FeedbackConstantSumResponseDetails;
      for (let i = 0; i < constsumResponse.answers.length && i < this.constsumOptions.length; i += 1) {
        const points = constsumResponse.answers[i] || 0;
        optionTotals[this.constsumOptions[i]] += points;
        totalPointsAcrossAllResponses += points;
      }
    }

    // Calculate averages per option
    for (const option of this.constsumOptions) {
      this.constsumAveragePerOption[option] = validResponses.length > 0
        ? +(optionTotals[option] / validResponses.length).toFixed(1) : 0;
    }

    this.constsumTotalPointsDistributed = totalPointsAcrossAllResponses;
    this.constsumAveragePointsPerResponse = validResponses.length > 0
      ? +(totalPointsAcrossAllResponses / validResponses.length).toFixed(1) : 0;
  }

  calculateContribStatistics(): void {
    const validResponses = this.responses.filter((r) => !r.isMissingResponse);
    this.contribValues = validResponses.map((response) => {
      const contribResponse = response.responseDetails as FeedbackContributionResponseDetails;
      return contribResponse.answer;
    });

    if (this.contribValues.length === 0) {
      this.contribAverage = 0;
      this.contribMedian = 0;
      this.contribMin = 0;
      this.contribMax = 0;
      this.contribStdDev = 0;
      this.contribDistribution = {};
      return;
    }

    // Calculate basic statistics
    const sortedValues = [...this.contribValues].sort((a, b) => a - b);
    this.contribMin = sortedValues[0];
    this.contribMax = sortedValues[sortedValues.length - 1];

    // Calculate average
    const sum = this.contribValues.reduce((acc, val) => acc + val, 0);
    this.contribAverage = +(sum / this.contribValues.length).toFixed(2);

    // Calculate median
    const mid = Math.floor(sortedValues.length / 2);
    this.contribMedian = sortedValues.length % 2 === 0
      ? +((sortedValues[mid - 1] + sortedValues[mid]) / 2).toFixed(2)
      : sortedValues[mid];

    // Calculate standard deviation
    const variance = this.contribValues.reduce((acc, val) => acc + Math.pow(val - this.contribAverage, 2), 0) / this.contribValues.length;
    this.contribStdDev = +Math.sqrt(variance).toFixed(2);

    // Calculate distribution
    this.contribDistribution = {};
    for (const value of this.contribValues) {
      this.contribDistribution[value] = (this.contribDistribution[value] || 0) + 1;
    }
  }
}
