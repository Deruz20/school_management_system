import { db } from "../db";
import { DocumentType, DocVerificationStatus } from "@prisma/client";
import { TenantContext, UnauthorizedError } from "./tenant-context";
import { AuditService } from "../services/audit.service";

export interface DocumentUploadInput {
  documentType: DocumentType;
  documentTitle: string;
  storageKey: string;
  fileSizeBytes?: number;
  mimeType?: string;
  sha256Checksum?: string;
}

export class DocumentDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new UnauthorizedError("Branch scope required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:read') ||
      perms.includes('admissions:read')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing read permission.");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError("Authenticated user and branch required.");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('students:write') ||
      perms.includes('admissions:write')
    ) {
      return true;
    }
    throw new UnauthorizedError("Missing write permission.");
  }

  /**
   * Records metadata for an uploaded student document.
   */
  static async uploadStudentDocument(ctx: TenantContext, studentId: string, data: DocumentUploadInput) {
    this.checkWritePermission(ctx);

    const student = await db.student.findFirst({
      where: { id: studentId, branchId: ctx.branchId }
    });
    if (!student) throw new Error("Student not found in this branch.");

    const doc = await db.studentDocument.create({
      data: {
        branchId: ctx.branchId,
        studentId,
        documentType: data.documentType,
        documentTitle: data.documentTitle.trim(),
        storageKey: data.storageKey.trim(),
        fileSizeBytes: data.fileSizeBytes || null,
        mimeType: data.mimeType || null,
        sha256Checksum: data.sha256Checksum || null,
        verificationStatus: DocVerificationStatus.PENDING,
        uploadedById: ctx.userId
      }
    });

    await AuditService.log(
      ctx,
      'document.uploaded',
      'StudentDocument',
      doc.id,
      `Uploaded ${doc.documentType} for student ${student.admissionNo}`
    );

    return doc;
  }

  /**
   * Records metadata for an uploaded applicant document.
   */
  static async uploadApplicantDocument(ctx: TenantContext, applicantId: string, data: DocumentUploadInput) {
    this.checkWritePermission(ctx);

    const applicant = await db.applicant.findFirst({
      where: { id: applicantId, branchId: ctx.branchId }
    });
    if (!applicant) throw new Error("Applicant not found in this branch.");

    const doc = await db.applicantDocument.create({
      data: {
        branchId: ctx.branchId,
        applicantId,
        documentType: data.documentType,
        documentTitle: data.documentTitle.trim(),
        storageKey: data.storageKey.trim(),
        fileSizeBytes: data.fileSizeBytes || null,
        mimeType: data.mimeType || null,
        sha256Checksum: data.sha256Checksum || null,
        verificationStatus: DocVerificationStatus.PENDING,
        uploadedById: ctx.userId
      }
    });

    await AuditService.log(
      ctx,
      'document.uploaded',
      'ApplicantDocument',
      doc.id,
      `Uploaded ${doc.documentType} for applicant ${applicant.applicationNumber}`
    );

    return doc;
  }

  /**
   * Formally verifies or rejects an uploaded document.
   */
  static async verifyDocument(
    ctx: TenantContext,
    documentId: string,
    isStudentDoc: boolean,
    data: { verified: boolean; notes?: string }
  ) {
    if (!ctx.branchId || !ctx.userId) throw new UnauthorizedError();
    const perms = ctx.permissions || [];
    if (!perms.includes('all') && !perms.includes('admissions:approve') && !perms.includes('students:write')) {
      throw new UnauthorizedError("Missing permission to verify documents.");
    }

    const status = data.verified ? DocVerificationStatus.VERIFIED : DocVerificationStatus.REJECTED;
    const action = data.verified ? 'document.verified' : 'document.rejected';

    if (isStudentDoc) {
      const doc = await db.studentDocument.findFirst({
        where: { id: documentId, branchId: ctx.branchId }
      });
      if (!doc) throw new Error("Student document not found.");

      const updated = await db.studentDocument.update({
        where: { id: documentId },
        data: {
          verificationStatus: status,
          verificationNotes: data.notes || null,
          verifiedById: ctx.userId,
          verifiedAt: new Date()
        }
      });

      await AuditService.log(ctx, action, 'StudentDocument', documentId, `Document ${status}: ${data.notes || ''}`);
      return updated;
    } else {
      const doc = await db.applicantDocument.findFirst({
        where: { id: documentId, branchId: ctx.branchId }
      });
      if (!doc) throw new Error("Applicant document not found.");

      const updated = await db.applicantDocument.update({
        where: { id: documentId },
        data: {
          verificationStatus: status,
          verificationNotes: data.notes || null,
          verifiedById: ctx.userId,
          verifiedAt: new Date()
        }
      });

      await AuditService.log(ctx, action, 'ApplicantDocument', documentId, `Document ${status}: ${data.notes || ''}`);
      return updated;
    }
  }

  /**
   * Lists documents for a student.
   */
  static async listStudentDocuments(ctx: TenantContext, studentId: string) {
    this.checkReadPermission(ctx);
    return db.studentDocument.findMany({
      where: { studentId, branchId: ctx.branchId },
      include: { verifiedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Lists documents for an applicant.
   */
  static async listApplicantDocuments(ctx: TenantContext, applicantId: string) {
    this.checkReadPermission(ctx);
    return db.applicantDocument.findMany({
      where: { applicantId, branchId: ctx.branchId },
      include: { verifiedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }
}
