package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/Pixie2468/rag-ops/internal/api"
	"github.com/Pixie2468/rag-ops/internal/tui"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run [json file]",
	Short: "Run the evaluation pipeline with the provided JSON data (defaults to data.json)",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		filePath := "data.json"
		if len(args) > 0 {
			filePath = args[0]
		} else {
			if _, err := os.Stat("data.json"); os.IsNotExist(err) {
				return fmt.Errorf("no input JSON file provided, and default 'data.json' was not found.\n\nUsage:\n  ragops run <file.json>\n\nExample:\n  ragops run data.json")
			}
			fmt.Println("ℹ️  No file specified. Using default 'data.json'...")
		}
		
		file, err := os.Open(filePath)
		if err != nil {
			return fmt.Errorf("failed to open file '%s': %w", filePath, err)
		}
		defer file.Close()
		
		byteValue, err := io.ReadAll(file)
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		var req api.EvalRequest
		if err := json.Unmarshal(byteValue, &req); err != nil {
			return fmt.Errorf("failed to unmarshal JSON: %w", err)
		}

		// Initialize BubbleTea model
		m := tui.NewModel(req)
		
		// Run TUI
		p := tea.NewProgram(m)
		
		finalModel, err := p.Run()
		if err != nil {
			return fmt.Errorf("TUI error: %w", err)
		}

		// Try to cast back to our model type
		if tuiModel, ok := finalModel.(tui.Model); ok {
			_, err := tuiModel.GetResponse()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Pipeline error: %v\n", err)
				os.Exit(1)
			}
			tuiModel.PrintJSON()
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
