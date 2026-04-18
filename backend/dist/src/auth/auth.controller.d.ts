import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    getProfile(user: any): Promise<{
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
