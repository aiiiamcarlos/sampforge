!include MUI2.nsh
!include nsDialogs.nsh
!include LogicLib.nsh
!include FileFunc.nsh
!ifndef BUILD_UNINSTALLER
Var SFGtaPath
Var SFGtaInput
Var SFDialog

!macro customPageAfterChangeDir
  Page custom SFGtaPage SFGtaLeave
!macroend

Function SFGtaPage
  !insertmacro MUI_HEADER_TEXT "GTA San Andreas" "SA-MP 0.3.7 + 0.3.DL"
  ${If} $SFGtaPath == ""
    ClearErrors
    FileOpen $0 "$DOCUMENTS\SampForge\game-path.txt" r
    ${IfNot} ${Errors}
      FileRead $0 $SFGtaPath
      FileClose $0
    ${EndIf}
  ${EndIf}
  nsDialogs::Create 1018
  Pop $SFDialog
  ${NSD_CreateLabel} 0 8u 100% 20u "Carpeta de GTA San Andreas v1.0"
  Pop $0
  ${NSD_CreateDirRequest} 0 34u 78% 14u "$SFGtaPath"
  Pop $SFGtaInput
  ${NSD_CreateBrowseButton} 80% 33u 20% 16u "Elegir"
  Pop $0
  ${NSD_OnClick} $0 SFGtaBrowse
  ${NSD_CreateLabel} 0 66u 100% 30u "Se instalarán las dos versiones automáticamente."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function SFGtaBrowse
  Pop $0
  nsDialogs::SelectFolderDialog "Carpeta de GTA" "$SFGtaPath"
  Pop $0
  ${If} $0 != error
    StrCpy $SFGtaPath $0
    ${NSD_SetText} $SFGtaInput $SFGtaPath
  ${EndIf}
FunctionEnd

Function SFGtaLeave
  ${NSD_GetText} $SFGtaInput $SFGtaPath
  IfFileExists "$SFGtaPath\gta_sa.exe" +3 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Selecciona la carpeta de GTA San Andreas."
    Abort
FunctionEnd

!macro customInstall
  ${If} $SFGtaPath == ""
    ; A silent upgrade uses the existing path; a fresh silent install accepts /GTA=.
    ${GetParameters} $0
    ${GetOptions} $0 "/GTA=" $SFGtaPath
    ${If} $SFGtaPath == ""
      ClearErrors
      FileOpen $0 "$DOCUMENTS\SampForge\game-path.txt" r
      ${IfNot} ${Errors}
        FileRead $0 $SFGtaPath
        FileClose $0
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ${If} $SFGtaPath == ""
    SetErrorLevel 2
    Quit
  ${EndIf}
  SetDetailsView show
  DetailPrint "Preparando SA-MP 0.3.7 + 0.3.DL..."
  sf_prepare_retry:
  nsExec::ExecToLog '"$INSTDIR\resources\native\SampForge.GameSetup.exe" --install-multi "$SFGtaPath"'
  Pop $0
  ${If} $0 != 0
    IfSilent sf_prepare_failed
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "No se pudo instalar SA-MP. Revisa los detalles." IDRETRY sf_prepare_retry
    sf_prepare_failed:
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend
!endif
