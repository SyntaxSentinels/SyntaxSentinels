import {
  HttpRequestException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Exception
} from './exceptions.js';
import _ from 'lodash';

export class ErrorContent {
  constructor(desc) {
    this.type = '';
    this.target = 'SyntaxSentinels';
    this.status = desc[0];
    this.code = '';
    this.message = desc[1];
    this.ext = {};
    this.raw = desc[2];
  }

  static convertFromException(exception) {
    const error = new ErrorContent([500, exception ? exception.message : 'Unknown error', {}]);

    if (exception instanceof BadRequestException) {
      error.status = 400;
    }
    if (exception instanceof UnauthorizedException) {
      error.status = 401;
    }
    if (exception instanceof ForbiddenException) {
      error.status = 403;
    }
    if (exception instanceof HttpRequestException) {
      error.status = exception.status ?? 500;
      error.ext = exception.details ?? {};
      error.code = exception.code;
    }
    if (exception instanceof Error) {
      error.status = 500;
    }
    return error;
  }

  getSummary() {
    const properties = ['type', 'target', 'status', 'code', 'message', 'ext'];
    return _.pick(this, properties);
  }

  getDetails() {
    const properties = ['type', 'target', 'status', 'code', 'message', 'ext', 'raw'];
    return _.pick(this, properties);
  }

  static convertFromExcToError(exception) {
    const errorContent = ErrorContent.convertFromException(exception);
    const error = new Error(JSON.stringify(errorContent.getDetails()));
    return error;
  }
}