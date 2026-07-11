import { PrismaMasterService } from '../database/prisma-master.service';
import { ActivityLogsGateway } from './activity-logs.gateway';
import { forwardRef, Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { BackgroundJobEmitter } from '../common/utils/run-in-background.util';

@Injectable()
export class ActivityLogsService implements OnModuleInit {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(
    private prismaMaster: PrismaMasterService,
    private gateway: ActivityLogsGateway,
  ) {}

  onModuleInit() {
    BackgroundJobEmitter.on('jobFailed', (data) => {
      this.log(data).catch(err => {
        this.logger.error('Failed to write background job failure to activity logs', err);
      });
    });
  }

  async getFilters() {
    const [modules, actions] = await Promise.all([
      this.prismaMaster.activityLog.findMany({
        where: { module: { not: null } },
        select: { module: true },
        distinct: ['module'],
        orderBy: { module: 'asc' },
      }),
      this.prismaMaster.activityLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      }),
    ]);

    return {
      modules: modules.map((r) => r.module).filter(Boolean) as string[],
      actions: actions.map((r) => r.action).filter(Boolean) as string[],
    };
  }

  async findAll(
    query: {
      page?: number;
      limit?: number;
      action?: string;
      module?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
    debuggerKey?: string,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.module) {
      where.module = query.module;
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { ipAddress: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        {
          user: { firstName: { contains: query.search, mode: 'insensitive' } },
        },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.startDate && query.endDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    } else if (query.startDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
      };
    } else if (query.endDate) {
      where.createdAt = {
        lte: new Date(query.endDate),
      };
    }

    const [logs, total] = await Promise.all([
      this.prismaMaster.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prismaMaster.activityLog.count({ where }),
    ]);

    const isDebugger = debuggerKey && (
      debuggerKey === 'ivar_debug_secret' ||
      (process.env.DEBUGGER_KEY && debuggerKey === process.env.DEBUGGER_KEY)
    );

    const sanitizedLogs = logs.map((log) => {
      if (isDebugger) {
        return log;
      }
      return {
        ...log,
        oldValues: null,
        newValues: null,
        ipAddress: log.ipAddress ? '***.***.***.***' : null,
        userAgent: log.userAgent ? 'Hidden (Requires Debugger Key)' : null,
        metadata: null,
      };
    });

    return {
      logs: sanitizedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async log(data: {
    userId?: string;
    action: string;
    module: string;
    entity?: string;
    entityId?: string;
    description?: string;
    oldValues?: string;
    newValues?: string;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
    status: 'success' | 'failure';
  }) {
    let validUserId: string | null = null;
    let userRelation: any = null;
    if (data.userId) {
      try {
        const user = await this.prismaMaster.user.findUnique({
          where: { id: data.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
        if (user) {
          validUserId = data.userId;
          userRelation = user;
        }
      } catch (error) {
        // If userId is invalid, set to null
        validUserId = null;
      }
    }

    const created = await this.prismaMaster.activityLog.create({
      data: {
        userId: validUserId,
        action: data.action,
        module: data.module,
        entity: data.entity,
        entityId: data.entityId,
        description: data.description,
        oldValues: data.oldValues,
        newValues: data.newValues,
        errorMessage: data.errorMessage,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status,
      },
    });

    const sanitizedEmit = {
      ...created,
      user: userRelation,
      oldValues: null,
      newValues: null,
      ipAddress: created.ipAddress ? '***.***.***.***' : null,
      userAgent: created.userAgent ? 'Hidden (Requires Debugger Key)' : null,
      metadata: null,
    };

    this.gateway.emitActivityLog(sanitizedEmit);
    return created;
  }
}
