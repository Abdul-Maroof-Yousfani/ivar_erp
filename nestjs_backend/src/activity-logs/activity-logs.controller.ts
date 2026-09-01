import { Controller, Get, Query, UseGuards, Headers } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService,) {}

  @Get('filters')
  getFilters() {
    return this.activityLogsService.getFilters();
  }

  @Get()
  findAll(
    @Query() query: any,
    @Headers() headers: Record<string, string>,
  ) {
    const debuggerKey = headers['x-debugger-key'] || headers['X-Debugger-Key'] || query.debuggerKey || query.debuggerkey;
    return this.activityLogsService.findAll(query, debuggerKey);
  }
}

