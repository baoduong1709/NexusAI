import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginatedQueryDto } from "../../common/dto/paginated-query.dto";

export class DocumentsQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ description: "Filter by employee folder" })
  @IsString()
  @IsOptional()
  folder?: string;
}
