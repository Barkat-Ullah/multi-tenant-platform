import httpStatus from 'http-status';
import { ticketService } from './ticket.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

// Filterable fields for ticket queries
const ticketFilterableFields = [
  'searchTerm',
  'status',
  'category',
  'priority',
  'createdById',
  'period',
  'rangeStartDay',
  'rangeEndDay',
  'bookingId',
];

// ============================================================
// CREATE TICKET (supports file uploads via multipart/form-data)
// ============================================================
const createTicket = catchAsync(async (req: Request, res: Response) => {
  const result = await ticketService.createTicket(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Ticket created successfully',
    data: result,
  });
});

// ============================================================
// GET TICKET LIST
// ============================================================
const getTicketList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, ticketFilterableFields);
  const result = await ticketService.getTicketList(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ticket list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// ============================================================
// GET TICKET BY ID
// ============================================================
const getTicketById = catchAsync(async (req: Request, res: Response) => {
  const result = await ticketService.getTicketById(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ticket details retrieved successfully',
    data: result,
  });
});



// ============================================================
// CHANGE TICKET STATUS
// ============================================================
const changeTicketStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ticketService.changeTicketStatus(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ticket status updated successfully',
    data: result,
  });
});

// ============================================================
// CREATE MESSAGE (supports file uploads via multipart/form-data)
// ============================================================
const createTicketMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await ticketService.createTicketMessage(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Reply added successfully',
    data: result,
  });
});

// ============================================================
// ADD SATISFACTION RATING
// ============================================================
const addSatisfactionRating = catchAsync(async (req: Request, res: Response) => {
  const result = await ticketService.addSatisfactionRating(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Satisfaction rating added successfully',
    data: result,
  });
});

// ============================================================
// GET ANALYTICS
// ============================================================
const getTicketAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await ticketService.getTicketAnalytics(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Ticket analytics retrieved successfully',
    data: result,
  });
});

// ============================================================
// EXPORT
// ============================================================
export const ticketController = {
  createTicket,
  getTicketList,
  getTicketById,
  changeTicketStatus,
  createTicketMessage,
  addSatisfactionRating,
  getTicketAnalytics,
};