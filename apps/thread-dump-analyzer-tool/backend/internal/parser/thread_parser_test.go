// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package parser

import (
	"strings"
	"testing"
)

const sampleDump = `"http-nio-8080-exec-1" #42 daemon prio=5 os_prio=0 cpu=123.4ms elapsed=10.5s tid=0x00007f1234567890 nid=0x1a2b waiting on condition
   java.lang.Thread.State: RUNNABLE (running)
	at java.net.SocketInputStream.read(SocketInputStream.java:1)
	at org.apache.tomcat.util.net.NioEndpoint.run(NioEndpoint.java:200)
	- locked <0x000000076b000000> (a java.lang.Object)

"blocker" #43 prio=5 tid=0x00007f0000000001 nid=0x2c3d waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
	at com.example.Service.work(Service.java:10)
	- waiting to lock <0x000000076b000abc> (a java.lang.Object)
`

func TestParseThread_HappyPath(t *testing.T) {
	threads, err := ParseThread(strings.NewReader(sampleDump))
	if err != nil {
		t.Fatalf("ParseThread: %v", err)
	}
	if len(threads) != 2 {
		t.Fatalf("expected 2 threads, got %d", len(threads))
	}

	first := threads[0]
	if first.Name != "http-nio-8080-exec-1" {
		t.Errorf("name=%q", first.Name)
	}
	if first.ID != "0x00007f1234567890" {
		t.Errorf("id=%q", first.ID)
	}
	if first.NativeID != 0x1a2b {
		t.Errorf("nativeID=%d, want %d", first.NativeID, 0x1a2b)
	}
	if first.State != "RUNNABLE" {
		t.Errorf("state=%q", first.State)
	}
	if first.CPUTime != 123.4 {
		t.Errorf("cpu=%v", first.CPUTime)
	}
	if first.ElapsedTime != 10.5 {
		t.Errorf("elapsed=%v", first.ElapsedTime)
	}
	if len(first.StackTrace) != 3 {
		t.Errorf("stack frames=%d, want 3", len(first.StackTrace))
	}

	second := threads[1]
	if second.State != "BLOCKED" {
		t.Errorf("state=%q", second.State)
	}
	if second.WaitingToLockAddress != "0x000000076b000abc" {
		t.Errorf("waiting=%q", second.WaitingToLockAddress)
	}
}

func TestParseThread_DeadlockPreFlag(t *testing.T) {
	// Need at least one thread header AFTER "victim" so victim is flushed before the
	// deadlock section starts (the section sets currentThread=nil and would otherwise drop it).
	dump := `"victim" #1 prio=5 tid=0x1 nid=0xa waiting
   java.lang.Thread.State: BLOCKED
	at x.y.Z(Z.java:1)

"other" #2 prio=5 tid=0x2 nid=0xb waiting
   java.lang.Thread.State: RUNNABLE
	at a.b.C(C.java:1)

Found 1 Java-level deadlock:
=============================
"victim":
  waiting to lock monitor 0x...
`
	threads, err := ParseThread(strings.NewReader(dump))
	if err != nil {
		t.Fatalf("ParseThread: %v", err)
	}
	var victim *Thread
	for i := range threads {
		if threads[i].Name == "victim" {
			victim = &threads[i]
		}
	}
	if victim == nil {
		t.Fatalf("victim thread not found; got %d threads", len(threads))
	}
	if !victim.IsDeadlocked {
		t.Errorf("expected IsDeadlocked=true")
	}
	if victim.RiskLevel != RiskCritical {
		t.Errorf("risk=%q, want CRITICAL", victim.RiskLevel)
	}
	if !victim.Analyzed {
		t.Errorf("expected Analyzed=true so the rules engine skips this thread")
	}
}

func TestParseThreadUsage_HexAndDecimalTID(t *testing.T) {
	usage := `PID  TID    %CPU   TIME
1234 0x1a2b 25.5   00:01:23
1234 12345  10.0   01:00.5
`
	usages, err := ParseThreadUsage(strings.NewReader(usage))
	if err != nil {
		t.Fatalf("ParseThreadUsage: %v", err)
	}
	if len(usages) != 2 {
		t.Fatalf("got %d usages", len(usages))
	}
	if usages[0].TID != 0x1a2b {
		t.Errorf("hex TID=%d, want %d", usages[0].TID, 0x1a2b)
	}
	if usages[1].TID != 12345 {
		t.Errorf("decimal TID=%d", usages[1].TID)
	}
	if usages[0].CPUPercentage != 25.5 {
		t.Errorf("cpu=%v", usages[0].CPUPercentage)
	}
	if usages[0].UserTime != (1*60+23)*1000.0 {
		t.Errorf("HH:MM:SS time=%v ms", usages[0].UserTime)
	}
	if usages[1].UserTime != 60500.0 {
		t.Errorf("MM:SS.mmm time=%v ms", usages[1].UserTime)
	}
}

func TestProcessAndCorrelate_JoinsByNativeID(t *testing.T) {
	usage := `1234 0x1a2b 80.0 00:00:01
1234 9999   1.0 00:00:01
`
	threads, _, err := ProcessAndCorrelate(strings.NewReader(sampleDump), strings.NewReader(usage), "dump.txt")
	if err != nil {
		t.Fatalf("ProcessAndCorrelate: %v", err)
	}

	var first *Thread
	for i := range threads {
		if threads[i].NativeID == 0x1a2b {
			first = &threads[i]
		}
	}
	if first == nil {
		t.Fatalf("matched thread missing")
	}
	if first.CPUPercentage != 80.0 {
		t.Errorf("cpu=%v, want correlated from usage row", first.CPUPercentage)
	}
}

func TestProcessAndCorrelate_RunawayCPUPreFlag(t *testing.T) {
	usage := `1234 0x1a2b 150.0 00:00:01`
	threads, _, err := ProcessAndCorrelate(strings.NewReader(sampleDump), strings.NewReader(usage), "dump.txt")
	if err != nil {
		t.Fatalf("ProcessAndCorrelate: %v", err)
	}
	for _, tr := range threads {
		if tr.NativeID == 0x1a2b {
			if tr.RiskLevel != RiskCritical || !tr.Analyzed {
				t.Errorf("runaway thread should be CRITICAL+Analyzed, got risk=%q analyzed=%v", tr.RiskLevel, tr.Analyzed)
			}
			return
		}
	}
	t.Fatal("target thread not found")
}

func TestParseTID(t *testing.T) {
	cases := []struct {
		in   string
		want int64
		ok   bool
	}{
		{"0x1a2b", 0x1a2b, true},
		{"0X1A2B", 0x1a2b, true},
		{"12345", 12345, true},
		{"abc", 0, false},
	}
	for _, c := range cases {
		got, ok := parseTID(c.in)
		if got != c.want || ok != c.ok {
			t.Errorf("parseTID(%q) = (%d,%v), want (%d,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestParseTime_Formats(t *testing.T) {
	cases := map[string]float64{
		"01:23":     83,
		"00:01:23":  83,
		"01:00.5":   60.5,
		"15":        15,
		"":          0,
	}
	for in, want := range cases {
		if got := parseTime(in); got != want {
			t.Errorf("parseTime(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestFilterUsagesByDominantPID(t *testing.T) {
	usages := []ThreadUsage{
		{PID: 1, TID: 1}, {PID: 1, TID: 2}, {PID: 1, TID: 3},
		{PID: 2, TID: 100},
	}
	filtered, dominant, count := FilterUsagesByDominantPID(usages)
	if count != 2 {
		t.Errorf("pidCount=%d, want 2", count)
	}
	if dominant != 1 {
		t.Errorf("dominant=%d, want 1", dominant)
	}
	if len(filtered) != 3 {
		t.Errorf("filtered len=%d, want 3", len(filtered))
	}
}

func TestThread_Helpers(t *testing.T) {
	tr := Thread{
		Name:       "Http-Nio-Exec",
		StackTrace: []string{"- locked <0x1> (a Foo)", "at Foo.bar(Foo.java:1)", "- locked <0x1> (a Foo)"},
	}
	if !tr.NameContains("http-nio") {
		t.Error("NameContains should be case-insensitive")
	}
	if tr.NameStartsWith("http-nio") {
		t.Error("NameStartsWith should be case-sensitive — 'Http-Nio' must not match prefix 'http-nio'")
	}
	if !tr.HasRepeatedLock() {
		t.Error("HasRepeatedLock should detect duplicate 0x1")
	}
	if got := tr.StackTraceCount("locked"); got != 2 {
		t.Errorf("StackTraceCount=%d, want 2", got)
	}
}
