package tui

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/Pixie2468/rag-ops/internal/api"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(time.Second*1, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

type Model struct {
	spinner  spinner.Model
	progress progress.Model
	err      error
	response *api.EvalResponse
	
	req api.EvalRequest

	percent  float64
	stage    int
	stages   []string
	quitting bool
}

func NewModel(req api.EvalRequest) Model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	p := progress.New(progress.WithDefaultGradient())

	return Model{
		spinner:  s,
		progress: p,
		req:      req,
		percent:  0.0,
		stage:    0,
		stages: []string{
			"Stage 1: Validating Input & Checking Refusals...",
			"Stage 2: Evaluating Context Relevance...",
			"Stage 3: Checking Groundedness (NLI / NER)...",
			"Stage 4: Evaluating Answer Faithfulness...",
			"Stage 5: Multi-hop LLM Judge Analysis...",
			"Finalizing Evaluation...",
		},
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		tickCmd(),
		m.runEvaluation(),
	)
}

func (m Model) runEvaluation() tea.Cmd {
	return func() tea.Msg {
		resp, err := api.RunEvaluation(m.req)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return EvalCompleteMsg{Response: resp}
	}
}

// Internal wrapper to carry the raw response if needed
type EvalCompleteMsg struct {
	Response *api.EvalResponse
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" || msg.String() == "q" {
			m.quitting = true
			return m, tea.Quit
		}
	case ErrMsg:
		m.err = msg.Err
		m.quitting = true
		return m, tea.Quit
	case EvalCompleteMsg:
		m.response = msg.Response
		m.percent = 1.0
		m.quitting = true
		return m, tea.Quit
	case tickMsg:
		if m.percent < 0.95 {
			m.percent += 0.05
			
			// Update stage text based on percentage
			stageIdx := int(m.percent * float64(len(m.stages)))
			if stageIdx >= len(m.stages) {
				stageIdx = len(m.stages) - 1
			}
			m.stage = stageIdx
		}
		return m, tickCmd()
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}
	return m, nil
}

func (m Model) View() string {
	if m.err != nil {
		return baseStyle.Render(fmt.Sprintf("Error: %v\n", m.err))
	}
	
	if m.quitting && m.response != nil {
		// Just output empty so the main function can print the JSON directly
		return ""
	}

	stageText := ""
	if m.stage < len(m.stages) {
		stageText = m.stages[m.stage]
	}

	header := headerStyle.Render(" RAGOps Evaluation Pipeline ")
	
	body := fmt.Sprintf("\n\n%s %s\n\n%s\n",
		m.spinner.View(),
		stageText,
		m.progress.ViewAs(m.percent),
	)

	return baseStyle.Render(header + body)
}

func (m Model) GetResponse() (*api.EvalResponse, error) {
	return m.response, m.err
}

func (m Model) PrintJSON() {
	if m.response != nil {
		b, err := json.MarshalIndent(m.response, "", "  ")
		if err != nil {
			fmt.Printf("Error marshalling JSON: %v\n", err)
			return
		}
		fmt.Println(string(b))
	}
}
