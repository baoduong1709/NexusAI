import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(dto: CreateUserDto): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
        skills: string[];
        role: {
            name: string;
            id: number;
        };
    }>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
        skills: string[];
        role: {
            name: string;
            id: number;
        };
    }[]>;
    findOne(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
        skills: string[];
        role: {
            name: string;
            id: number;
        };
    }>;
    update(id: number, dto: UpdateUserDto): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
        skills: string[];
        role: {
            name: string;
            id: number;
        };
    }>;
    remove(id: number): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
        skills: string[];
        role: {
            name: string;
            id: number;
        };
    }>;
}
