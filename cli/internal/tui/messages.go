package tui

type ProgressMsg struct {
	Metric     string
	Percentage int
	Log        string
	Overall    int
}

type CompleteMsg struct {
	Output       string
	FinalMetrics map[string]float64
	Samples      []string
}

type ErrMsg struct{ Err error }
