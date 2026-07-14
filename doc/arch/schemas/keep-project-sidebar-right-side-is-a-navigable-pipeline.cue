// DDD role: ValueObject

package schemas

// Layout and navigation state for pipeline stage board (feature 002).

// DDD role: ValueObject
#GraphFocus: "pipeline_strip" | "stage_board" | "job_log"

// DDD role: ValueObject
#Flag: bool

// DDD role: ValueObject
#StageName: string & !=""

// DDD role: ValueObject
#EntityId: int & >0

// DDD role: ValueObject
#BoardCursor: {
	pipelineIndex: int & >=0
	stageIndex:    int & >=0
	jobIndex:      int & >=0
}

// DDD role: ValueObject
#PipelineGraphChrome: {
	graphFocus:     #GraphFocus
	logOpen:        #Flag
	board:          #BoardCursor
	// project cursor moves independently; openProjectId is the graph source
	openProjectId?: #EntityId
}

// Feature root
// DDD role: ValueObject
#KeepProjectSidebarRightSideIsANavigablePipeline: #PipelineGraphChrome
