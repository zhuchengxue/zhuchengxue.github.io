Option Explicit

Dim shell, root
Set shell = CreateObject("WScript.Shell")

If WScript.Arguments.Count = 0 Then
  WScript.Quit 1
End If

root = WScript.Arguments(0)
shell.CurrentDirectory = root
shell.Run "node.exe scripts\writing-dashboard.mjs", 0, False
