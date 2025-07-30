import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { LoadingRetryModule } from '../loading-retry/loading-retry.module';
import { LoadingSpinnerModule } from '../loading-spinner/loading-spinner.module';
import { QuestionAnalyticsComponent } from './question-analytics.component';

@NgModule({
  declarations: [QuestionAnalyticsComponent],
  imports: [
    CommonModule,
    LoadingRetryModule,
    LoadingSpinnerModule,
  ],
  exports: [QuestionAnalyticsComponent],
})
export class QuestionAnalyticsModule { }
