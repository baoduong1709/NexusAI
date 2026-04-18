import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(dto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: number;
            name: string;
            email: string;
            role: {
                permissions: import("@prisma/client/runtime/library").JsonValue;
                name: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
            };
            skills: string[];
        };
    }>;
    getProfile(userId: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
        skills: string[];
        role: {
            permissions: import("@prisma/client/runtime/library").JsonValue;
            name: string;
            id: number;
        };
    }>;
}
