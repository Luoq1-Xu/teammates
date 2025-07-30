import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoadingRetryModule } from '../../components/loading-retry/loading-retry.module';
import { LoadingSpinnerModule } from '../../components/loading-spinner/loading-spinner.module';
import { PanelChevronModule } from '../../components/panel-chevron/panel-chevron.module';
import { QuestionAnalyticsModule } from '../../components/question-analytics/question-analytics.component.module';
import { QuestionTextWithInfoModule } from '../../components/question-text-with-info/question-text-with-info.module';
import { InstructorSessionAnalyticsPageComponent } from './instructor-session-analytics-page.component';

const routes: Routes = [
  {
    path: '',
    component: InstructorSessionAnalyticsPageComponent,
  },
];

@NgModule({
  declarations: [InstructorSessionAnalyticsPageComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    LoadingSpinnerModule,
    LoadingRetryModule,
    QuestionTextWithInfoModule,
    PanelChevronModule,
    QuestionAnalyticsModule,
  ],
})
export class InstructorSessionAnalyticsPageModule {}
