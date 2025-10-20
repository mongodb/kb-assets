// Copyright 2019-present Kuei-chun Chen. All rights reserved.
// replset_status.go

package ftdc

import (
	"time"
)

// PRIMARY - primary node
const PRIMARY = "PRIMARY"

// SECONDARY - secondary node
const SECONDARY = "SECONDARY"

// MemberDoc stores replset status
type MemberDoc struct {
	Name   string      `json:"name" bson:"name"`
	Optime interface{} `json:"optime" bson:"optime"`
	State  int         `json:"state" bson:"state"`
}

// ReplSetStatusDoc stores replset status
type ReplSetStatusDoc struct {
	Date    time.Time   `json:"date" bson:"date"`
	Members []MemberDoc `json:"members" bson:"members"`
}
