import {
  HttpError,
  badRequest,
  conflict,
  createErrorResponse,
  createSuccessResponse,
  created,
  forbidden,
  internalError,
  noContent,
  notFound,
  ok,
  unauthorized,
} from '@shared/core';
import { describe, expect, it, vi } from 'vitest';

describe('Types and Response Helpers', () => {
  describe('HttpError', () => {
    it('should create HttpError with statusCode and message', () => {
      const error = new HttpError(404, 'Not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.name).toBe('HttpError');
      expect(error.details).toBeUndefined();
    });

    it('should create HttpError with details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new HttpError(400, 'Validation error', details);

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Validation error');
      expect(error.details).toEqual(details);
    });
  });

  describe('createErrorResponse', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should create error response from HttpError', () => {
      const error = new HttpError(400, 'Bad request', { field: 'email' });
      const response = createErrorResponse(error);

      expect(response.statusCode).toBe(400);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Bad request');
      expect(body.details).toEqual({ field: 'email' });
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('should create generic error response from regular Error', () => {
      const error = new Error('Something went wrong');
      const response = createErrorResponse(error);

      expect(response.statusCode).toBe(500);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Internal server error');
      expect(body.timestamp).toBeDefined();
      expect(body.details).toBeUndefined();
    });

    it('should create generic error response from string', () => {
      const response = createErrorResponse('String error');

      expect(response.statusCode).toBe(500);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Internal server error');
      expect(body.timestamp).toBeDefined();
    });

    it('should log error to console', () => {
      const error = new Error('Test error');
      createErrorResponse(error);

      expect(console.error).toHaveBeenCalledWith('Lambda execution error:', error);
    });
  });

  describe('createSuccessResponse', () => {
    it('should return existing response object if already formatted', () => {
      const existingResponse = {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '123' }),
      };

      const response = createSuccessResponse(existingResponse);

      expect(response).toBe(existingResponse);
    });

    it('should create response from object data', () => {
      const data = { id: '123', name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe(JSON.stringify(data));
    });

    it('should create response from string data', () => {
      const data = 'plain text response';
      const response = createSuccessResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe(data);
    });

    it('should handle null data', () => {
      const response = createSuccessResponse(null);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe('null');
    });

    it('should handle undefined data', () => {
      const response = createSuccessResponse(undefined);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe(JSON.stringify(undefined));
    });
  });

  describe('HTTP Error Helpers', () => {
    it('should throw badRequest error', () => {
      expect(() => badRequest('Invalid data')).toThrow(HttpError);

      try {
        badRequest('Invalid data', { field: 'email' });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(400);
        expect((error as HttpError).message).toBe('Invalid data');
        expect((error as HttpError).details).toEqual({ field: 'email' });
      }
    });

    it('should throw unauthorized error', () => {
      expect(() => unauthorized()).toThrow(HttpError);

      try {
        unauthorized('Custom unauthorized message');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(401);
        expect((error as HttpError).message).toBe('Custom unauthorized message');
      }
    });

    it('should throw forbidden error', () => {
      expect(() => forbidden()).toThrow(HttpError);

      try {
        forbidden('Access denied');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(403);
        expect((error as HttpError).message).toBe('Access denied');
      }
    });

    it('should throw notFound error', () => {
      expect(() => notFound()).toThrow(HttpError);

      try {
        notFound('Resource not found');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(404);
        expect((error as HttpError).message).toBe('Resource not found');
      }
    });

    it('should throw conflict error', () => {
      expect(() => conflict('Resource exists')).toThrow(HttpError);

      try {
        conflict('Resource exists', { id: '123' });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(409);
        expect((error as HttpError).message).toBe('Resource exists');
        expect((error as HttpError).details).toEqual({ id: '123' });
      }
    });

    it('should throw internalError', () => {
      expect(() => internalError()).toThrow(HttpError);

      try {
        internalError('Database error', { code: 'DB001' });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).statusCode).toBe(500);
        expect((error as HttpError).message).toBe('Database error');
        expect((error as HttpError).details).toEqual({ code: 'DB001' });
      }
    });
  });

  describe('HTTP Success Helpers', () => {
    it('should create ok response', () => {
      const data = { id: '123', name: 'Test' };
      const response = ok(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe(JSON.stringify(data));
    });

    it('should create created response', () => {
      const data = { id: '123', name: 'Created Resource' };
      const response = created(data);

      expect(response.statusCode).toBe(201);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe(JSON.stringify(data));
    });

    it('should create noContent response', () => {
      const response = noContent();

      expect(response.statusCode).toBe(204);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toBe('');
    });
  });
});
