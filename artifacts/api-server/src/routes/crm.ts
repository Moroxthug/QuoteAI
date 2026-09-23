import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import { db } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  projectsTable,
  projectTasksTable,
  collaboratorsTable,
  projectAssignmentsTable,
  suppliersTable,
} from "@workspace/db";
import { z } from "zod";
import { permitCompletionBlock } from "../compliance/service.js";


const router = Router();

// ── PROJECTS (CANTIERI) ──────────────────────────────────────────────────────
router.get("/crm/projects", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.userId, userId));
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Error fetching projects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/crm/projects", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      quoteId: z.string().uuid().optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      budget: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    const { name, description, quoteId, status, startDate, endDate, budget } = parsed.data;

    const [project] = await db
      .insert(projectsTable)
      .values({
        userId,
        name,
        description: description ?? "",
        quoteId: quoteId ?? null,
        status: (status ?? "planning") as "planning" | "active" | "suspended" | "completed",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget: budget ?? 0,
      })
      .returning();

    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Error creating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/crm/projects/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = req.params;

    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      budget: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    // Phase 87: the same permit rule as PUT /api/jobs/:id — open permits keep a job from completing.
    if (parsed.data.status === "completed") {
      const [owned] = await db.select({ id: projectsTable.id, status: projectsTable.status }).from(projectsTable).where(and(eq(projectsTable.id, id as string), eq(projectsTable.userId, userId)));
      const blocked = owned && owned.status !== "completed" ? await permitCompletionBlock(owned.id) : null;
      if (blocked) {
        res.status(409).json(blocked);
        return;
      }
    }

    const updates: Record<string, any> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.startDate !== undefined) updates.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    if (parsed.data.endDate !== undefined) updates.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    if (parsed.data.budget !== undefined) updates.budget = parsed.data.budget;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" }); // drizzle throws on an empty set()
      return;
    }

    const [updated] = await db
      .update(projectsTable)
      .set(updates)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/crm/projects/:id", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { id } = req.params;

    const [deleted] = await db
      .delete(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting project");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PROJECT TASKS (PRATICHE E SCADENZE) ───────────────────────────────────────
router.get("/crm/projects/:projectId/tasks", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { projectId } = req.params;

    // Verify ownership of the project first
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const tasks = await db
      .select()
      .from(projectTasksTable)
      .where(eq(projectTasksTable.projectId, projectId));

    res.json(tasks);
  } catch (err) {
    req.log.error({ err }, "Error fetching project tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/crm/projects/:projectId/tasks", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { projectId } = req.params;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.string().optional(),
      dueDate: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    const [task] = await db
      .insert(projectTasksTable)
      .values({
        projectId,
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        status: parsed.data.status ?? "todo",
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      })
      .returning();

    res.status(201).json(task);
  } catch (err) {
    req.log.error({ err }, "Error creating task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/crm/projects/:projectId/tasks/:taskId", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { projectId, taskId } = req.params;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const schema = z.object({
      status: z.enum(["todo", "in_progress", "done"]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    const [updated] = await db
      .update(projectTasksTable)
      .set({ status: parsed.data.status })
      .where(and(eq(projectTasksTable.id, taskId), eq(projectTasksTable.projectId, projectId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating task status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PROJECT ASSIGNMENTS (OPERAI ASSEGNATI AL CANTIERE) ───────────────────────
router.get("/crm/projects/:projectId/assignments", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { projectId } = req.params;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const rows = await db
      .select({
        id: projectAssignmentsTable.id,
        projectId: projectAssignmentsTable.projectId,
        collaboratorId: projectAssignmentsTable.collaboratorId,
        roleInProject: projectAssignmentsTable.roleInProject,
        createdAt: projectAssignmentsTable.createdAt,
        collaboratorName: collaboratorsTable.name,
        collaboratorRole: collaboratorsTable.role,
        collaboratorHourlyRate: collaboratorsTable.hourlyRate,
      })
      .from(projectAssignmentsTable)
      .innerJoin(collaboratorsTable, eq(projectAssignmentsTable.collaboratorId, collaboratorsTable.id))
      .where(eq(projectAssignmentsTable.projectId, projectId));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching project assignments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/crm/projects/:projectId/assignments", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { projectId } = req.params;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const schema = z.object({
      collaboratorId: z.string().uuid(),
      roleInProject: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    const [collaborator] = await db
      .select()
      .from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.id, parsed.data.collaboratorId), eq(collaboratorsTable.userId, userId)));

    if (!collaborator) {
      res.status(404).json({ error: "Collaborator not found" });
      return;
    }

    const [assignment] = await db
      .insert(projectAssignmentsTable)
      .values({
        projectId,
        collaboratorId: parsed.data.collaboratorId,
        roleInProject: parsed.data.roleInProject ?? "",
      })
      .returning();

    res.status(201).json({ ...assignment, collaboratorName: collaborator.name, collaboratorRole: collaborator.role, collaboratorHourlyRate: collaborator.hourlyRate });
  } catch (err) {
    req.log.error({ err }, "Error creating project assignment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/crm/projects/:projectId/assignments/:assignmentId", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { projectId, assignmentId } = req.params;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [deleted] = await db
      .delete(projectAssignmentsTable)
      .where(and(eq(projectAssignmentsTable.id, assignmentId), eq(projectAssignmentsTable.projectId, projectId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting project assignment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── COLLABORATORS (COLLABORATORI E STIPENDI) ─────────────────────────────────
router.get("/crm/collaborators", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const collaborators = await db
      .select()
      .from(collaboratorsTable)
      .where(eq(collaboratorsTable.userId, userId));
    res.json(collaborators);
  } catch (err) {
    req.log.error({ err }, "Error fetching collaborators");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/crm/collaborators", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const schema = z.object({
      name: z.string().min(1),
      role: z.string().optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      hourlyRate: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    const [collaborator] = await db
      .insert(collaboratorsTable)
      .values({
        userId,
        name: parsed.data.name,
        role: parsed.data.role ?? "worker",
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        hourlyRate: parsed.data.hourlyRate ?? 0,
      })
      .returning();

    res.status(201).json(collaborator);
  } catch (err) {
    req.log.error({ err }, "Error creating collaborator");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── SUPPLIERS (FORNITORI) ───────────────────────────────────────────────────
router.get("/crm/suppliers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const suppliers = await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.userId, userId));
    res.json(suppliers);
  } catch (err) {
    req.log.error({ err }, "Error fetching suppliers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/crm/suppliers", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      contactInfo: z.string().optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters", details: parsed.error });
      return;
    }

    const [supplier] = await db
      .insert(suppliersTable)
      .values({
        userId,
        name: parsed.data.name,
        category: parsed.data.category ?? "",
        contactInfo: parsed.data.contactInfo ?? "",
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
      })
      .returning();

    res.status(201).json(supplier);
  } catch (err) {
    req.log.error({ err }, "Error creating supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── EXTRA COSTS (COSTI EXTRA) ───────────────────────────────────────────────
// Extra costs moved to cost_entries in Phase 3 (routes/costs.ts).

// Invoicing is native since Phase 4 (routes/invoices.ts); the Fatture in Cloud mock is gone.

export default router;
