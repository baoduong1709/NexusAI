import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

@Injectable()
export class MarkitdownService implements OnModuleInit {
  private readonly logger = new Logger(MarkitdownService.name);
  private isAvailable = false;
  private commandPrefix: "python -m markitdown" | "markitdown" | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.checkAndInstallMarkitdown();
  }

  /**
   * Checks if markitdown CLI is available. Installation is opt-in because package
   * installation during application startup is slow and changes the host environment.
   */
  private async checkAndInstallMarkitdown() {
    try {
      this.logger.log("Checking if 'markitdown' CLI is available...");
      // Check using python module execution first as it's more reliable across environments
      await execAsync("python -m markitdown --version");
      this.isAvailable = true;
      this.commandPrefix = "python -m markitdown";
      this.logger.log("Microsoft MarkItDown is available via python module.");
      return;
    } catch {
      this.logger.warn("MarkItDown not found via python module. Checking direct command...");
    }

    try {
      await execAsync("markitdown --version");
      this.isAvailable = true;
      this.commandPrefix = "markitdown";
      this.logger.log("Microsoft MarkItDown is available via direct CLI.");
      return;
    } catch {
      this.logger.warn("Microsoft MarkItDown CLI is not installed.");
    }

    const autoInstallEnabled =
      this.configService
        .get<string>("MARKITDOWN_AUTO_INSTALL", "false")
        .toLowerCase() === "true";
    if (!autoInstallEnabled) {
      this.logger.warn(
        "Document conversion is disabled. Install MarkItDown manually or set MARKITDOWN_AUTO_INSTALL=true.",
      );
      return;
    }

    try {
      // Auto-install using pip
      this.logger.log("Running 'pip install markitdown'...");
      await execAsync("pip install markitdown");
      
      // Verify again after installation
      try {
        await execAsync("python -m markitdown --version");
        this.isAvailable = true;
        this.commandPrefix = "python -m markitdown";
        this.logger.log("Microsoft MarkItDown installed successfully!");
      } catch {
        await execAsync("markitdown --version");
        this.isAvailable = true;
        this.commandPrefix = "markitdown";
        this.logger.log("Microsoft MarkItDown installed successfully!");
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-install MarkItDown. Manual installation required: 'pip install markitdown'. Error: ${
          (error as Error).message
        }`
      );
      this.isAvailable = false;
      this.commandPrefix = null;
    }
  }

  /**
   * Check if markitdown is successfully integrated and available.
   */
  isMarkitdownAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Convert a document file to markdown.
   * @param inputPath Absolute path to the original document (pdf, docx, xlsx, pptx, etc.)
   * @param outputPath Absolute path where the converted markdown file will be saved
   * @returns true if successful, false otherwise
   */
  async convertToMarkdown(inputPath: string, outputPath: string): Promise<boolean> {
    if (!this.isAvailable || !this.commandPrefix) {
      this.logger.warn(`Skipping conversion. MarkItDown is not available. File: ${inputPath}`);
      return false;
    }

    if (!fs.existsSync(inputPath)) {
      this.logger.warn(`Source file does not exist: ${inputPath}`);
      return false;
    }

    try {
      this.logger.log(`Converting file to Markdown: ${inputPath} -> ${outputPath}`);
      
      const command = `${this.commandPrefix} "${inputPath}" -o "${outputPath}"`;
      
      // Run the command
      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        this.logger.log(`Successfully converted: ${inputPath}`);
        return true;
      } else {
        this.logger.warn(`Command completed but output file was not created: ${outputPath}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error converting document to Markdown: ${(error as Error).message}`);
      return false;
    }
  }
}
