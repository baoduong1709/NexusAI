"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const projects_service_1 = require("./projects.service");
const create_project_dto_1 = require("./dto/create-project.dto");
const update_project_workflow_dto_1 = require("./dto/update-project-workflow.dto");
const update_project_roles_dto_1 = require("./dto/update-project-roles.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let ProjectsController = class ProjectsController {
    constructor(projectsService) {
        this.projectsService = projectsService;
    }
    create(dto) {
        return this.projectsService.create(dto);
    }
    findAll(user) {
        return this.projectsService.findAll(user);
    }
    findOne(id) {
        return this.projectsService.findOne(id);
    }
    update(id, dto) {
        return this.projectsService.update(id, dto);
    }
    updateWorkflow(id, dto) {
        return this.projectsService.updateWorkflow(id, dto);
    }
    updateRoles(id, dto) {
        return this.projectsService.updateRoles(id, dto);
    }
    remove(id) {
        return this.projectsService.remove(id);
    }
    addMember(id, userId, body) {
        return this.projectsService.addMember(id, userId, body?.projectRole);
    }
    updateMemberRole(id, userId, body) {
        return this.projectsService.updateMemberRole(id, userId, body.projectRole);
    }
    removeMember(id, userId) {
        return this.projectsService.removeMember(id, userId);
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermissions)("project:create"),
    (0, swagger_1.ApiOperation)({ summary: "Create a project" }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_project_dto_1.CreateProjectDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Get all projects" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, permissions_decorator_1.RequirePermissions)("project:read"),
    (0, swagger_1.ApiOperation)({ summary: "Get project detail" }),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(":id"),
    (0, permissions_decorator_1.RequirePermissions)("project:update"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_project_dto_1.CreateProjectDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(":id/workflow"),
    (0, permissions_decorator_1.RequirePermissions)("project:update"),
    (0, swagger_1.ApiOperation)({ summary: "Update project task workflow" }),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_project_workflow_dto_1.UpdateProjectWorkflowDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "updateWorkflow", null);
__decorate([
    (0, common_1.Patch)(":id/roles"),
    (0, permissions_decorator_1.RequirePermissions)("project:update"),
    (0, swagger_1.ApiOperation)({ summary: "Update project member roles" }),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_project_roles_dto_1.UpdateProjectRolesDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "updateRoles", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, permissions_decorator_1.RequirePermissions)("project:delete"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(":id/members/:userId"),
    (0, permissions_decorator_1.RequirePermissions)("project:update"),
    (0, swagger_1.ApiOperation)({ summary: "Add member to project" }),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)("userId", common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "addMember", null);
__decorate([
    (0, common_1.Patch)(":id/members/:userId"),
    (0, permissions_decorator_1.RequirePermissions)("project:update"),
    (0, swagger_1.ApiOperation)({ summary: "Update member project role" }),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)("userId", common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "updateMemberRole", null);
__decorate([
    (0, common_1.Delete)(":id/members/:userId"),
    (0, permissions_decorator_1.RequirePermissions)("project:update"),
    (0, swagger_1.ApiOperation)({ summary: "Remove member from project" }),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)("userId", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "removeMember", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, swagger_1.ApiTags)("Projects"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)("projects"),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map